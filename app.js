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
// const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

//forExcelToMongoose
const fs = require('fs');
const parser = require("simple-excel-to-json");
var multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); //Appending extension
  },
});

const upload = multer({storage: storage});


//requiring models
const User = require('./models/User');
const Shop = require('./models/Shop');
const Stock = require('./models/Stock');

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

app.get('/userData', (req, res, next) => {
  if (req.user)
    res.send(req.user);
  else
    res.json("You Must Login in First Boiii!!")
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
  const {name, quantity, description, price} = req.body;
  const newMeds = {name, quantity, description, price};
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
    if (stock.medicine[i].name == newMeds.name) {
      break;
    }
  }
  if (i != stock.medicine.length)
    stock.medicine[i].quantity += newMeds.quantity;
  else
    stock.medicine.push(newMeds);
  
  await stock.save();
  res.redirect('/shop/stock');
});

app.post('/shop/stock/excel', upload.single("upload"), async (req, res) => {
  const fileName = req.file.filename;
  const newMeds1 = parser.parseXls2Json("./uploads/" + fileName);
  const newMeds = newMeds1[0];
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
      if (stock.medicine[i].name == x.name) {
        break;
      }
    }
    if (i != stock.medicine.length)
      stock.medicine[i].quantity += x.quantity;
    else
      stock.medicine.push(x);
  }
  
  await stock.save();
  res.redirect('/shop/stock');
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
  const currentShop = await Shop.findById(req.params.ShopId);
  const shopName = currentShop.name;
  const stockOfCS = await Stock.findById(currentShop.stockInfo);
  const meds = stockOfCS.medicine;
  res.render('./User/particularShop', {shopName, meds})
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
        medicineName: particularMed.name,
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

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Listening on port ${port}`));