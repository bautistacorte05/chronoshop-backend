import { Schema, model } from 'mongoose';

const cartSchema = new Schema({
  products: [
    {
      product:  { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, default: 1, min: 1 },
    },
  ],
});

export const Cart = model('Cart', cartSchema);
