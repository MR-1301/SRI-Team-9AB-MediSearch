const mongoose = require('mongoose');
const {Schema} = mongoose;
const User = require('./User');
const Shop = require('./Shop');
const prescriptionShema = new Schema({
  imageURL: {
    type: String,
    default:"lol",
    required: true
  },
  userID: {
    type: Schema.Types.ObjectId,
    required: true
  },
  comments: [
    {
      commenterID: {
        type: Schema.Types.ObjectId,
        required: true
      },
      text: {
        type: String,
        required: true
      }
    }
  ]
});


module.exports = mongoose.model("Prescription", prescriptionShema);