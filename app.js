if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}
const express = require('express');
const app = express();
const mongoose = require("mongoose");
const cookieParser = require('cookie-parser');
const session = require("express-session");
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser')
const passport = require("passport");
const passportLocal = require("passport-local").Strategy
const bcrypt = require('bcryptjs');
const {jsPDF} = require("jspdf");
const {storage} = require('./config/cloudinary');
// const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

//forExcelToMongoose
const fs = require('fs');
const parser = require("simple-excel-to-json");
var multer = require("multer");
var multerEx = require('multer');
const storageEx = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); //Appending extension
  },
});
const uploadEx = multerEx({storage: storageEx});
const upload = multer({storage});

//requiring models
const User = require('./models/User');
const Shop = require('./models/Shop');
const Stock = require('./models/Stock');
const UserOrder = require('./models/userOrder');
const Prescription = require('./models/Prescription');
//connecting to mongoose
const dbURI = process.env.DBURI;
mongoose
  .connect(dbURI, {useUnifiedTopology: true, useNewUrlParser: true})
  .then(() => {
    console.log("DB connected!!")
  })
  .catch((err) => console.error({err}));

//ejs things
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const flash = require("connect-flash");
const path = require("path");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

//session stuff
const secret = process.env.SECRET;

const store = MongoStore.create({
  mongoUrl: dbURI,
  touchAfter: 24 * 60 * 60,
  crypto: {
    secret
  }
});

store.on("error", function (e) {
  console.log("session store Error", e);
});


const sessionConfig = {
  store,
  secret,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    // secure:true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};

app.use(
  session(sessionConfig)
);

app.use(flash());

//passport stuff
app.use(cookieParser("secretcode"));
app.use(passport.initialize());
app.use(passport.session());
require("./config/passportConfig")(passport);

//basic middleware
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  return next();
});

//routes
app.get("/", (req, res) => {
  res.render('home');
})

app.get('/login', (req, res) => {
  res.render('login');
})

app.post("/login",
  (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) throw err;
      if (!user) return res.send("No User Exists");
      else {
        req.logIn(user, (err) => {
          if (err) throw err;
          res.redirect('/');
        });
      }
    })(req, res, next)
  });

app.get("/logout", async (req, res, next) => {
  await req.logOut();
  res.redirect('/');
});

app.get('/auth/google', passport.authenticate('google', {scope: "profile email"}))

//callback from google API
app.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/login'}), (req, res) => {
  const user = req.user;
  if (!user) {
    res.send("No user exist");
  } else {
    req.logIn(user, (err) => {
      if (err) throw err;
      return res.redirect('/');
    });
  }
});

app.get('/orderDetails/:orderID', async (req, res) => {
  const orderDet = await UserOrder.findById(req.params.orderID);
  const Cuser = await User.findById(orderDet.userID);
  const CShop = await Shop.findById(orderDet.shopID);
  let nameOfUser = 'Offline';
  if (Cuser)
    nameOfUser = Cuser.name;
  const nameOfShop = CShop.name;
  
  res.render('./orderDetails', {orderDet, nameOfUser, nameOfShop});
});

app.get('/shop/register', (req, res) => {
  res.render('./Shop/register');
});

app.post('/shop/register', async (req, res, next) => {
  User.findOne({username: req.body.username}, async (err, doc) => {
    if (err) throw err;
    if (doc) res.send("User Already Exists");
    if (!doc) {
      const {username, owName, password, aadharCardNo} = req.body;
      const {shopName, email, shopPhoneNumber, licenceNo, address, pincode} = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({username, name: owName, password: hashedPassword, aadharCardNo, position: 1});
      const newShop = new Shop({name: shopName, email, shopPhoneNumber, licenceNo, address, pincode});
      newUser.shopInfo = newShop._id;
      newShop.owner = newUser._id;
      await newUser.save();
      await newShop.save();
      res.redirect('/login');
    }
  });
});

app.get("/shop/stock", async (req, res) => {
  if (!req.user)
    return res.redirect('/login');
  if (req.user.position !== 1)
    return res.send("Shop Owner Not Authenticated!");
  const shopID = req.user.shopInfo;
  const shop = await Shop.findById(shopID).populate("stockInfo");
  let meds;
  if (shop.stockInfo)
    meds = shop.stockInfo.medicine;
  res.render("./Shop/showStock", {meds});
});

app.get("/shop/stock/new", (req, res) => {
  res.render("./Shop/newMedsManual");
});

app.post("/shop/stock/manual", async (req, res) => {
  //newMeds is array of new medicines
  const {name, quantity, company, mg, price} = req.body;
  const newMeds = {
    name, quantity, price, description: {company, mg}
  };
  console.log(newMeds);
  if (!req.user)
    return res.redirect('/login');
  if (req.user.position !== 1)
    return res.send("Shop Owner Not Authenticated!");
  
  const shopID = req.user.shopInfo;
  const shop = await Shop.findById(shopID);
  if (!shop.stockInfo) {
    const newStock = new Stock({medicine: newMeds});
    newStock.shopID = shopID;
    shop.stockInfo = newStock;
    await newStock.save();
    await shop.save();
    return res.redirect('/shop/stock');
  }
  
  const stock = await Stock.findById(shop.stockInfo);
  let i;
  for (i = 0; i < stock.medicine.length; i++) {
    if (stock.medicine[i].name == newMeds.name && stock.medicine[i].description.company == company && stock.medicine[i].description.mg == mg) {
      break;
    }
  }
  if (i != stock.medicine.length) {
    let q1 = parseInt(stock.medicine[i].quantity);
    let q2 = parseInt(newMeds.quantity);
    stock.medicine[i].quantity = q1 + q2;
  } else
    stock.medicine.push(newMeds);
  
  await stock.save();
  res.redirect('/shop/stock');
});

app.post('/shop/stock/excel', uploadEx.single("upload"), async (req, res) => {
  const fileName = req.file.filename;
  const newMeds1 = parser.parseXls2Json("./uploads/" + fileName);
  let newMeds = []
  for (let i = 0; i < newMeds1[0].length; i++) {
    let obj = {
      name: newMeds1[0][i].medicine,
      description: {
        company: newMeds1[0][i].company,
        mg: newMeds1[0][i].mg
      },
      quantity: newMeds1[0][i].quantity,
      price: newMeds1[0][i].price
    }
    newMeds.push(obj);
  }
  
  console.log(newMeds);
  
  if (!req.user)
    return res.redirect('/login');
  
  if (req.user.position !== 1)
    return res.send("Shop Owner Not Authenticated!");
  
  const shopID = req.user.shopInfo;
  const shop = await Shop.findById(shopID);
  if (!shop.stockInfo) {
    const newStock = new Stock({medicine: newMeds});
    newStock.shopID = shopID;
    shop.stockInfo = newStock;
    await newStock.save();
    await shop.save();
    return res.redirect('/shop/stock');
  }
  
  const stock = await Stock.findById(shop.stockInfo);
  for (let x of newMeds) {
    let i;
    for (i = 0; i < stock.medicine.length; i++) {
      if (stock.medicine[i].name == x.name && stock.medicine[i].description.company==x.description.company && stock.medicine[i].description.mg==x.description.mg) {
        break;
      }
    }
    if (i != stock.medicine.length) {
      let q1 = parseInt(stock.medicine[i].quantity);
      let q2 = parseInt(x.quantity);
      stock.medicine[i].quantity = q1 + q2;
    } else
      stock.medicine.push(x);
  }
  
  await stock.save();
  res.redirect('/shop/stock');
});

app.get('/shop/update/:medID', async (req, res) => {
  const shopC = await Shop.findById(req.user.shopInfo);
  const stockC = await Stock.findById(shopC.stockInfo);
  const medsInfo = stockC.medicine;
  // console.log(medsInfo);
  // return res.send("LOL!");
  let partMed;
  for (let i = 0; i < medsInfo.length; i++) {
    if (JSON.stringify(medsInfo[i]._id) === JSON.stringify(req.params.medID)) {
      partMed = medsInfo[i];
      break;
    }
  }
  
  res.render('./Shop/medUpdate', {partMed});
});

app.post('/shop/update/:medID', async (req, res) => {
  const shopC = await Shop.findById(req.user.shopInfo);
  const currStock = await Stock.findById(shopC.stockInfo);
  const {name, quantity, company, mg, price} = req.body;
  const newMeds = {
    name, quantity, price, description: {company, mg}
  };
  
  for (let i = 0; i < currStock.medicine.length; i++) {
    if (JSON.stringify(currStock.medicine[i]._id) === JSON.stringify(req.params.medID)) {
      currStock.medicine[i] = newMeds;
      break;
    }
  }
  await currStock.save();
  res.redirect('/shop/stock');
});

app.post('/shop/delete/:medID', async (req, res) => {
  const shopC = await Shop.findById(req.user.shopInfo);
  const currStock = await Stock.findById(shopC.stockInfo);
  currStock.medicine = currStock.medicine.filter(val => JSON.stringify(val._id) != JSON.stringify(req.params.medID));
  await currStock.save();
  res.redirect('/shop/stock');
});

shopCurrentOrder = [];

app.get('/shop/offlineOrder', async (req, res) => {
  if (!req.user)
    return res.redirect('/login');
  if (req.user.position !== 1)
    return res.send("Shop Owner Not Authenticated!");
  shopCurrentOrder = [];
  const shopID = req.user.shopInfo;
  const shop = await Shop.findById(shopID).populate("stockInfo");
  let meds;
  if (shop.stockInfo)
    meds = shop.stockInfo.medicine;
  res.render("./Shop/offlineOrder", {meds, shopID});
});

app.post('/shop/placeOrder', async (req, res) => {
  const medsIds = req.body.medID;
  const Qty = req.body.quantity;
  let orderInfo = [];
  const shopID = req.user.shopInfo;
  const currentShop = await Shop.findById(shopID);
  const stockOfCS = await Stock.findById(currentShop.stockInfo);
  const meds = stockOfCS.medicine;
  for (let i = 0; i < medsIds.length; i++) {
    let partMed = meds.find(obj => JSON.stringify(obj._id) === JSON.stringify(medsIds[i]));
    if (Qty[i] > 0) {
      orderInfo.push({
        medID: partMed._id,
        medName: partMed.name,
        medPrice: partMed.price,
        medQuantity: Qty[i],
        medCompany: partMed.description.company,
        medMg: partMed.description.mg,
      });
    }
  }
  shopCurrentOrder = orderInfo;
  res.render('./Shop/proceedCart', {shopName: currentShop.name, orderInfo});
});

app.get('/shop/afterOfflineOrder', async (req, res) => {
  let totalCost = 0;
  for (let i = 0; i < shopCurrentOrder.length; i++) {
    totalCost += parseInt(shopCurrentOrder[i].medPrice) * parseInt(shopCurrentOrder[i].medQuantity);
  }
  
  const dateObj = new Date();
  const month = dateObj.getMonth();
  const day = String(dateObj.getDate()).padStart(2, '0');
  const year = dateObj.getFullYear();
  const output = day + '-' + month + '-' + year;
  
  const newOrder = new UserOrder({
    shopID: req.user.shopInfo,
    orderInfo: shopCurrentOrder,
    totalCost,
    deliveryStatus: 1,
    date: output,
  });
  await newOrder.save();
  const printOrder = shopCurrentOrder;
  
  //remove from stock
  let currShop = await Shop.findById(req.user.shopInfo);
  let currStock = await Stock.findById(currShop.stockInfo);
  for (let x of shopCurrentOrder) {
    for (let i = 0; i < currStock.medicine.length; i++) {
      if (JSON.stringify(currStock.medicine[i]._id) === JSON.stringify(x.medID)) {
        let q1 = parseInt(currStock.medicine[i].quantity);
        let q2 = parseInt(x.medQuantity);
        if (q1 - q2 == 0) {
          currStock.medicine = currStock.medicine.filter(val => JSON.stringify(val._id) != JSON.stringify(x.medID));
        } else
          currStock.medicine[i].quantity = q1 - q2;
        break;
      }
    }
  }
  await currStock.save();
  shopCurrentOrder = [];
  const shopID = req.user.shopInfo;
  const currentShop = await Shop.findById(shopID);
  res.render('./Shop/afterOrder', {shopName: currentShop.name, orderInfo: printOrder, jsPDF});
});

app.get('/shop/pendingOrders', async (req, res) => {
  const shopOrder = await UserOrder.find({shopID: req.user.shopInfo});
  let customerName = [];
  for (let i = 0; i < shopOrder.length; i++) {
    const customer = await User.findById(shopOrder[i].userID);
    if (customer)
      customerName.push(customer.name);
    else
      customerName.push("Offline");
  }
  res.render('./Shop/orderPending', {shopOrder, customerName});
});

app.get('/shop/confirmedOrders', async (req, res) => {
  const shopOrder = await UserOrder.find({shopID: req.user.shopInfo});
  let customerName = [];
  for (let i = 0; i < shopOrder.length; i++) {
    const customer = await User.findById(shopOrder[i].userID);
    if (customer)
      customerName.push(customer.name);
    else
      customerName.push("Offline");
  }
  res.render('./Shop/orderConfrimed', {shopOrder, customerName});
});

app.post('/shop/changeStatus/:OrderID', async (req, res) => {
  const ord = await UserOrder.findById(req.params.OrderID);
  ord.deliveryStatus = 1 - ord.deliveryStatus;
  await ord.save();
  const next = req.body.next;
  res.redirect(`/shop/${next}`);
});

app.get('/shop/prescription', async (req, res) => {
  const prescriptions = await Prescription.find();
  let userName = [];
  for (let x of prescriptions) {
    const userC = await User.findById(x.userID);
    userName.push(userC.name);
  }
  res.render('./Shop/allPrescription', {prescriptions, userName});
});

app.get('/shop/prescription/:presID', async (req, res) => {
  const prescription = await Prescription.findById(req.params.presID);
  const userC = await User.findById(prescription.userID);
  let shopName = [];
  for (let x of prescription.comments) {
    const shopC = await Shop.findById(x.commenterID);
    shopName.push(shopC.name);
  }
  res.render('./Shop/particularPrescription', {prescription, userName: userC.name, shopName});
});

app.post('/shop/prescription/:presID', async (req, res) => {
  let prescription = await Prescription.findById(req.params.presID);
  const newComment = {
    commenterID: req.user.shopInfo,
    text: req.body.content
  };
  prescription.comments.push(newComment);
  await prescription.save();
  res.redirect(`/shop/prescription/${req.params.presID}`);
});

let currentOrder = [];

app.get('/user/register', (req, res) => {
  res.render('./User/register');
})

app.post('/user/register', async (req, res, next) => {
  User.findOne({username: req.body.username}, async (err, doc) => {
    if (err) throw err;
    if (doc) res.send("User Already Exists");
    if (!doc) {
      const {username, name, email, password, mobileNo, aadharCardNo} = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({username, password: hashedPassword, name, email, mobileNo, aadharCardNo, position: 0});
      await newUser.save();
      res.redirect('/login');
    }
  });
});

app.get('/user/shops', async (req, res) => {
  const shops = await Shop.find();
  if (!req.user)
    res.redirect('/login');
  
  if (req.user.position == 1)
    return res.redirect('/shop/stock');
  
  res.render('./User/allShops', {shops});
});

app.get('/user/viewShop/:ShopId', async (req, res) => {
  currentOrder = [];
  const currentShop = await Shop.findById(req.params.ShopId);
  const shopName = currentShop.name;
  const stockOfCS = await Stock.findById(currentShop.stockInfo);
  const meds = stockOfCS.medicine;
  res.render('./User/particularShop', {shopID: req.params.ShopId, shopName, meds})
});

app.get('/user/searchMedicine', async (req, res) => {
  let allMedicines = [];
  
  const allShops = await Shop.find();
  
  for (let shop of allShops) {
    const stockInShop = await Stock.findById(shop.stockInfo);
    const medsInShop = stockInShop.medicine;
    for (let particularMed of medsInShop) {
      allMedicines.push({
        shopId: shop._id,
        shopName: shop.name,
        shopAddress: shop.address,
        medicineName: particularMed.name,
        medicineCompany: particularMed.description.company,
        medicineMg: particularMed.description.mg,
        medicineQuantity: particularMed.quantity
      });
    }
  }
  
  allMedicines.sort((a, b) => {
    if (a.medicineName == b.medicineName) {
      if (a.medicineQuantity > b.medicineQuantity)
        return -1;
      return 1;
    }
    if (a.medicineName < b.medicineName) {
      return -1;
    }
    if (a.medicineName > b.medicineName) {
      return 1;
    }
    return 0;
  });
  
  res.render('./User/allMedicineSearch', {allMedicines});
});

app.post('/user/placeOrder/:ShopId', async (req, res) => {
  const medsIds = req.body.medID;
  const Qty = req.body.quantity;
  let orderInfo = [];
  const currentShop = await Shop.findById(req.params.ShopId);
  const stockOfCS = await Stock.findById(currentShop.stockInfo);
  const meds = stockOfCS.medicine;
  for (let i = 0; i < medsIds.length; i++) {
    let partMed = meds.find(obj => JSON.stringify(obj._id) === JSON.stringify(medsIds[i]));
    if (Qty[i] > 0) {
      orderInfo.push({
        medID: partMed._id,
        medName: partMed.name,
        medPrice: partMed.price,
        medQuantity: Qty[i],
        medCompany: partMed.description.company,
        medMg: partMed.description.mg
      });
    }
  }
  currentOrder = orderInfo;
  res.render('./User/proceedCart', {currentShop, orderInfo});
});

app.get('/user/paymentGateway/:ShopID', (req, res) => {
  let totalCost = 0;
  for (let i = 0; i < currentOrder.length; i++) {
    totalCost += parseInt(currentOrder[i].medPrice) * parseInt(currentOrder[i].medQuantity);
  }
  totalCost = (totalCost * 105) / 100;
  res.render('./User/paymentGateway', {totalCost, ShopID: req.params.ShopID});
});

app.post("/user/afterPlacingOrder/:ShopID", async (req, res) => {
  let totalCost = 0;
  for (let i = 0; i < currentOrder.length; i++) {
    totalCost += parseInt(currentOrder[i].medPrice) * parseInt(currentOrder[i].medQuantity);
  }
  
  const dateObj = new Date();
  const month = dateObj.getMonth();
  const day = String(dateObj.getDate()).padStart(2, '0');
  const year = dateObj.getFullYear();
  const output = day + '-' + month + '-' + year;
  
  const newOrder = new UserOrder({
    userID: req.user._id,
    shopID: req.params.ShopID,
    orderInfo: currentOrder,
    totalCost,
    deliveryStatus: 0,
    date: output,
  });
  
  newOrder.token = newOrder._id;
  const ToKeN = newOrder.token;
  await newOrder.save();
  const orderInfo = currentOrder;
  const customerName = req.user.name;
  
  //remove from stock
  let currShop = await Shop.findById(req.params.ShopID);
  let currStock = await Stock.findById(currShop.stockInfo);
  for (let x of currentOrder) {
    for (let i = 0; i < currStock.medicine.length; i++) {
      if (JSON.stringify(currStock.medicine[i]._id) === JSON.stringify(x.medID)) {
        let q1 = parseInt(currStock.medicine[i].quantity);
        let q2 = parseInt(x.medQuantity);
        if (q1 - q2 == 0) {
          currStock.medicine = currStock.medicine.filter(val => JSON.stringify(val._id) != JSON.stringify(x.medID));
        } else
          currStock.medicine[i].quantity = q1 - q2;
        break;
      }
    }
  }
  await currStock.save();
  
  currentOrder = [];
  const currentShop = await Shop.findById(req.params.ShopID);
  const shopName = currentShop.name;
  res.render('./User/afterOrder', {orderInfo, customerName, shopName, ToKeN});
});

app.get("/user/orders", async (req, res) => {
  let userOrders = await UserOrder.find({userID: req.user._id});
  
  let shopName = [];
  
  for (let i = 0; i < userOrders.length; i++) {
    const shop = await Shop.findById(userOrders[i].shopID);
    shopName.push(shop.name);
  }
  res.render('./User/orderHistory', {userOrders, shopName});
});

app.get('/user/prescription', async (req, res) => {
  const prescriptions = await Prescription.find({userID: req.user._id});
  // return res.send(prescriptions);
  res.render('./User/allPrescription', {prescriptions});
});

app.get('/user/prescription/:presID', async (req, res) => {
  const prescription = await Prescription.findById(req.params.presID);
  let shopName = [];
  for (let x of prescription.comments) {
    const shopC = await Shop.findById(x.commenterID);
    shopName.push(shopC.name);
  }
  console.log(shopName);
  res.render('./User/particularPrescription', {prescription, shopName});
});

app.get('/user/newPres', async (req, res) => {
  res.render('./User/newPres');
});

app.post('/user/newPres', upload.single('image'), async (req, res) => {
  const pres = new Prescription({
    imageURL: req.file.path,
    userID: req.user._id,
    comments: []
  });
  const obj = await pres.save();
  res.redirect('/user/prescription');
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Listening on port ${port}`));