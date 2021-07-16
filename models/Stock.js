const mongoose = require('mongoose');
const {Schema} = mongoose;
const Shop = require('./Shop');

const stockSchema = new Schema({
  medicine: [{
    name: {
      type: String,
      required: true
    },
    description: {
      company: {
        type: String,
        required: true
      },
      mg: {
        type: String,
        required: true
      }
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    price: {
      type: String,
      required: true
    }
  }],
  shopID: {
    type: Schema.Types.ObjectId,
    ref: "Shop"
  }
});

module.exports = mongoose.model("Stock", stockSchema);