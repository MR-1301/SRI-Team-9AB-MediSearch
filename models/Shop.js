const mongoose = require('mongoose');
const {Schema} = mongoose;
const User = require('./User');
const Stock = require('./Stock');

const shopSchema = new Schema({
  name: {
    type: String,
    require: true
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  email: {
    type: String,
  },
  shopPhoneNumber: [{
    type: String,
    required: true
  }],
  licenceNo: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  pincode: {
    type: Number,
    requried: true,
  },
  stockInfo: {
    type: Schema.Types.ObjectId,
    ref: "Stock"
  }
});

module.exports = mongoose.model("Shop", shopSchema);