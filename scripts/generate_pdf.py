#!/usr/bin/env python3
"""
Convierte ENTREGA-BACKEND2.md a PDF académico usando reportlab.
"""
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Paleta de colores ────────────────────────────────────────────────────────
C_TITLE    = colors.HexColor("#1a1a2e")
C_H1       = colors.HexColor("#16213e")
C_H2       = colors.HexColor("#0f3460")
C_H3       = colors.HexColor("#1a5276")
C_CODE_BG  = colors.HexColor("#f4f4f8")
C_CODE_FG  = colors.HexColor("#2d2d2d")
C_BORDER   = colors.HexColor("#d0d4e0")
C_TABLE_H  = colors.HexColor("#0f3460")
C_TABLE_R  = colors.HexColor("#eaf0fb")
C_HR       = colors.HexColor("#c0c8d8")
C_INLINE   = colors.HexColor("#c0392b")

PAGE_W, PAGE_H = A4
MARGIN = 2.2 * cm

# ── Estilos ──────────────────────────────────────────────────────────────────
base = getSampleStyleSheet()

def make_style(name, **kw):
    defaults = dict(fontName="Helvetica", fontSize=10, leading=14,
                    textColor=colors.HexColor("#2c2c2c"), spaceAfter=4,
                    spaceBefore=0, alignment=TA_LEFT)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)

STYLES = {
    "cover_title": make_style("cover_title", fontName="Helvetica-Bold",
                              fontSize=22, leading=28, textColor=C_TITLE,
                              alignment=TA_CENTER, spaceAfter=8),
    "cover_sub":   make_style("cover_sub", fontSize=13, leading=18,
                              textColor=C_H2, alignment=TA_CENTER, spaceAfter=6),
    "cover_meta":  make_style("cover_meta", fontSize=10, textColor=colors.grey,
                              alignment=TA_CENTER, spaceAfter=4),
    "h1":  make_style("h1", fontName="Helvetica-Bold", fontSize=16, leading=20,
                      textColor=C_H1, spaceBefore=16, spaceAfter=6),
    "h2":  make_style("h2", fontName="Helvetica-Bold", fontSize=13, leading=17,
                      textColor=C_H2, spaceBefore=12, spaceAfter=4),
    "h3":  make_style("h3", fontName="Helvetica-Bold", fontSize=11, leading=15,
                      textColor=C_H3, spaceBefore=8, spaceAfter=3),
    "h4":  make_style("h4", fontName="Helvetica-BoldOblique", fontSize=10,
                      textColor=C_H3, spaceBefore=6, spaceAfter=2),
    "body": make_style("body", fontSize=10, leading=15,
                       textColor=colors.HexColor("#2c2c2c"),
                       alignment=TA_JUSTIFY, spaceAfter=6),
    "li":   make_style("li", fontSize=10, leading=14,
                       leftIndent=14, firstLineIndent=0, spaceAfter=3),
    "code_block": ParagraphStyle(
        "code_block",
        fontName="Courier", fontSize=8.5, leading=12,
        textColor=C_CODE_FG, backColor=C_CODE_BG,
        leftIndent=10, rightIndent=10,
        spaceBefore=4, spaceAfter=4,
        borderColor=C_BORDER, borderWidth=0.5,
        borderPadding=(6, 6, 6, 6),
        wordWrap="CJK",
    ),
}


# ── Helpers de texto inline ──────────────────────────────────────────────────
def inline(text: str, style_name="body") -> str:
    """Aplica bold, italic, inline code con XML de reportlab."""
    # Escapar & < > primero
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # **bold**
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    # *italic*
    text = re.sub(r"\*(.+?)\*", r"<i>\1</i>", text)
    # `inline code`
    text = re.sub(
        r"`([^`]+)`",
        r'<font name="Courier" color="#c0392b">\1</font>',
        text,
    )
    return text


def para(text: str, style=None) -> Paragraph:
    style = style or STYLES["body"]
    return Paragraph(inline(text), style)


# ── Parser de Markdown ───────────────────────────────────────────────────────
def parse_md(md_text: str):
    """Convierte el Markdown a flowables de reportlab."""
    story = []
    lines = md_text.splitlines()
    i = 0
    in_code = False
    code_lines = []
    code_lang = ""

    def flush_code():
        nonlocal code_lines, code_lang
        if not code_lines:
            return
        # Agrupar en un solo Preformatted para preservar saltos de línea
        raw = "\n".join(code_lines)
        story.append(Preformatted(raw, STYLES["code_block"]))
        story.append(Spacer(1, 4))
        code_lines = []
        code_lang = ""

    while i < len(lines):
        line = lines[i]

        # ── Bloque de código ──────────────────────────────────────
        if line.startswith("```"):
            if not in_code:
                in_code = True
                code_lang = line[3:].strip()
            else:
                in_code = False
                flush_code()
            i += 1
            continue

        if in_code:
            code_lines.append(line)
            i += 1
            continue

        # ── Separador horizontal ──────────────────────────────────
        if re.match(r"^---+$", line.strip()):
            story.append(Spacer(1, 4))
            story.append(HRFlowable(width="100%", thickness=0.5, color=C_HR))
            story.append(Spacer(1, 4))
            i += 1
            continue

        # ── Encabezados ───────────────────────────────────────────
        m = re.match(r"^(#{1,4})\s+(.*)", line)
        if m:
            level = len(m.group(1))
            text  = m.group(2).strip()
            sname = {1: "h1", 2: "h2", 3: "h3", 4: "h4"}.get(level, "h3")
            story.append(para(text, STYLES[sname]))
            if level == 1:
                story.append(HRFlowable(width="100%", thickness=1,
                                        color=C_H1, spaceAfter=4))
            elif level == 2:
                story.append(HRFlowable(width="40%", thickness=0.4,
                                        color=C_BORDER, spaceAfter=2))
            i += 1
            continue

        # ── Tabla markdown ────────────────────────────────────────
        if "|" in line and i + 1 < len(lines) and re.match(r"^\s*\|[-:| ]+\|\s*$", lines[i + 1]):
            # Recolectar filas
            table_lines = [line]
            j = i + 1
            while j < len(lines) and "|" in lines[j]:
                table_lines.append(lines[j])
                j += 1
            # Saltar línea de separador
            rows_raw = [table_lines[0]] + table_lines[2:]
            table_data = []
            for row_line in rows_raw:
                cells = [c.strip() for c in row_line.strip().strip("|").split("|")]
                table_data.append(cells)
            if table_data:
                # Cabecera + filas
                header = table_data[0]
                body_rows = table_data[1:]
                col_count = len(header)
                col_w = (PAGE_W - 2 * MARGIN - 0.5 * cm) / col_count

                tbl_data = []
                # Fila encabezado
                tbl_data.append([
                    Paragraph(f"<b>{inline(c)}</b>",
                               make_style("th", fontName="Helvetica-Bold",
                                          fontSize=8.5, textColor=colors.white,
                                          alignment=TA_CENTER))
                    for c in header
                ])
                for ri, row in enumerate(body_rows):
                    bg = C_TABLE_R if ri % 2 == 0 else colors.white
                    tbl_data.append([
                        Paragraph(inline(c),
                                  make_style(f"td{ri}", fontSize=8.5,
                                             leading=12, alignment=TA_CENTER))
                        for c in (row + [""] * (col_count - len(row)))[:col_count]
                    ])

                tbl = Table(tbl_data, colWidths=[col_w] * col_count,
                            repeatRows=1, hAlign="LEFT")
                tbl.setStyle(TableStyle([
                    ("BACKGROUND",    (0, 0), (-1, 0),  C_TABLE_H),
                    ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
                    ("ROWBACKGROUNDS",(0, 1), (-1, -1), [C_TABLE_R, colors.white]),
                    ("GRID",          (0, 0), (-1, -1), 0.3, C_BORDER),
                    ("TOPPADDING",    (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING",   (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
                    ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ]))
                story.append(tbl)
                story.append(Spacer(1, 8))
            i = j
            continue

        # ── Listas ────────────────────────────────────────────────
        m_li = re.match(r"^(\s*)[-*]\s+(.*)", line)
        if m_li:
            indent = len(m_li.group(1))
            bullet = "•" if indent == 0 else "◦"
            text = m_li.group(2)
            li_style = make_style(f"li{indent}", fontSize=10, leading=14,
                                  leftIndent=14 + indent * 10,
                                  firstLineIndent=0, spaceAfter=2)
            story.append(Paragraph(f"{bullet}  {inline(text)}", li_style))
            i += 1
            continue

        # ── Línea vacía ───────────────────────────────────────────
        if not line.strip():
            story.append(Spacer(1, 4))
            i += 1
            continue

        # ── Párrafo normal ────────────────────────────────────────
        # Acumular líneas contiguas no vacías
        block = [line]
        j = i + 1
        while j < len(lines) and lines[j].strip() and not lines[j].startswith("#") \
              and not lines[j].startswith("|") and not lines[j].startswith("```") \
              and not re.match(r"^[-*]\s", lines[j]) and not re.match(r"^---+$", lines[j].strip()):
            block.append(lines[j])
            j += 1
        text = " ".join(block)
        story.append(para(text))
        i = j

    flush_code()
    return story


# ── Portada ──────────────────────────────────────────────────────────────────
def build_cover():
    items = [
        Spacer(1, 3 * cm),
        para("SISTEMA DE AUTENTICACIÓN HÍBRIDO CON NODE.JS", STYLES["cover_title"]),
        Spacer(1, 0.4 * cm),
        HRFlowable(width="60%", thickness=1.5, color=C_H2, hAlign="CENTER"),
        Spacer(1, 0.6 * cm),
        para("Documentación Técnica — Backend 2 | Proyecto Final", STYLES["cover_sub"]),
        Spacer(1, 1.2 * cm),
        para("Proyecto: ChronoShop Backend", STYLES["cover_meta"]),
        para("Alumno: Bautista Cortez Pincha", STYLES["cover_meta"]),
        para("Repositorio: github.com/bautistacorte05/chronoshop-backend", STYLES["cover_meta"]),
        para("Fecha: 2026-05-20", STYLES["cover_meta"]),
        Spacer(1, 2 * cm),
        HRFlowable(width="80%", thickness=0.5, color=C_BORDER, hAlign="CENTER"),
        Spacer(1, 0.8 * cm),
        para(
            "Implementación de un sistema de autenticación híbrido que combina "
            "Passport Local (email + bcrypt), OAuth 2.0 (GitHub y Google), "
            "tokens JWT en cookie httpOnly y sesiones persistidas en MongoDB.",
            make_style("cover_desc", fontSize=11, leading=16, alignment=TA_CENTER,
                       textColor=colors.HexColor("#555555")),
        ),
        PageBreak(),
    ]
    return items


# ── Header/footer ────────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    # Header
    canvas.setFillColor(C_H1)
    canvas.rect(MARGIN, PAGE_H - 1.4 * cm, PAGE_W - 2 * MARGIN, 0.35 * cm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawString(MARGIN + 4, PAGE_H - 1.1 * cm, "ChronoShop — Sistema de Autenticación Híbrido")
    canvas.drawRightString(PAGE_W - MARGIN - 4, PAGE_H - 1.1 * cm, "Backend 2 | Bautista Cortez Pincha")
    # Footer
    canvas.setStrokeColor(C_BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(MARGIN, 1.4 * cm, PAGE_W - MARGIN, 1.4 * cm)
    canvas.setFillColor(colors.grey)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(MARGIN, 1.0 * cm, "Sistema de Autenticación Híbrido con Node.js")
    canvas.drawRightString(PAGE_W - MARGIN, 1.0 * cm, f"Página {doc.page}")
    canvas.restoreState()


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    src  = Path("/Users/Bautista/Entrega-backend1/ENTREGA-BACKEND2.md")
    dest = Path("/Users/Bautista/Entrega-backend1/ENTREGA-BACKEND2.pdf")

    print(f"Leyendo {src}...")
    md_text = src.read_text(encoding="utf-8")

    # Eliminar la primera línea de título (la ponemos en la portada)
    lines = md_text.splitlines()
    start = next((i for i, l in enumerate(lines) if l.startswith("## ")), 0)
    body_text = "\n".join(lines[start:])

    doc = SimpleDocTemplate(
        str(dest),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title="Sistema de Autenticación Híbrido con Node.js",
        author="Bautista Cortez Pincha",
        subject="Backend 2 — Proyecto Final",
    )

    story = build_cover() + parse_md(body_text)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"PDF generado: {dest}")
    print(f"Tamaño: {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
