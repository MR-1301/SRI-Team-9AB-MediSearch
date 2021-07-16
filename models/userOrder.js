const mongoose = require('mongoose');
const {Schema} = mongoose;
const User = require('./User');
const Shop = require('./Shop');

const orderSchema = new Schema({
  token: {
    type: Schema.Types.ObjectId,
  },
  shopID: {
    type: Schema.Types.ObjectId,
    ref: "Shop"
  },
  userID: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  orderInfo: [
    {
      medID: {
        type: Schema.Types.ObjectId,
        require: true
      },
      medName: {
        type: String,
        require: true,
      },
      medPrice: {
        type: String,
        require: true,
      },
      medQuantity: {
        type: String,
        require: true,
      },
      medCompany: {
        type: String,
        required: true
      },
      medMg: {
        type: String,
        required: true
      }
    }
  ],
  deliveryStatus: {
    type: Number,
    require: true,
  },
  totalCost: {
    type: Number,
    require: true,
    default: 0,
  },
  date: {
    type: String,
    require: true
  }
});

module.exports = mongoose.model("UserOrder", orderSchema);