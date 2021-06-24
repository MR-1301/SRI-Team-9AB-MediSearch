const mongoose = require('mongoose');
const {Schema} = mongoose;
const Shop=require('./Shop');

const userSchema = new Schema({
  googleId:{
    type: String, 
  },
  username:{
    type:String,
    required:true,
  },
  password:{
    type:String,
  },
  name:{
    type:String,
    required:true
  },
  mobileNo:[{
    type:String,
  }],
  email:{
    type: String,
  },
  aadharCardNo:{
    type: String,
    require: false,
  },
  position:{
    type: Number,
    required:true,
  },
  shopInfo:{
    type:Schema.Types.ObjectId,
    ref: "Shop",
  }
});

module.exports = mongoose.model("User", userSchema);