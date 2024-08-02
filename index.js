const port = 4000;
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());

// Database connection with MongoDB
const dbURI = 'mongodb+srv://aakanshakansal56:Hapur123@StyleSphere.i5ifed5.mongodb.net/';
console.log(`Connecting to MongoDB at ${dbURI}`);
mongoose.connect(dbURI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.error(`Error connecting to MongoDB: ${error}`));

// API creation
app.get("/", (req, res) => {
    res.send("Express app is running");
});

// Image storage engine
const storage = multer.diskStorage({
    destination: './upload/images/',
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// Create upload endpoint for images
app.use('/images', express.static('upload/images'));

app.post("/upload", upload.single('product'), (req, res) => {
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    });
});

// Schema for creating products
const Product = new mongoose.model("Product", {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true,
    },
});

app.post('/addproduct', async (req, res) => {
    let products = await Product.find({});
    let id;
    if(products.length > 0)
    {
        let last_product_array= products.slice(-1);
        let last_product=last_product_array[0];
        id=last_product.id+1;
    }
    else{
        id=1;
    }
    const product = new Product({
        id:id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    });

    console.log(product);
    await product.save();
    
    res.json({
        success: true,
        name: req.body.name,
    });
});


// Creating API for deleting products 

app.post('/removeproduct',async(req, res) =>{

    await Product.findOneAndDelete({id:req.body.id});
    console.log("Removed");
    res.json({
        success: true,
        name:req.body.name
    });
})


// Creating API for getting all products 


app.get('/allproducts',async(req,res)=>{
    let products = await Product.find({});
    
    res.send(products)

})



// Schema creating for user model

const Users = mongoose.model('Users',{
    name: {
        type:String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
    },
    cartData:{
        type:Object,
    },
    date:{
        type: Date,
        default: Date.now,
    }
})


// Creating Endpoint for registering user

app.post('/signup', async (req, res)=>{
    let check = await Users.findOne({email:req.body.email});
    if(check){
        return res.status(400).json({success: false, errors: 'Email already exists'})
    }
    let cart={};
    for(let i=0;i<300;i++)
    {
        cart[i]=0;
    }
    const user=new Users({
        name:req.body.name,
        email:req.body.email,
        password:req.body.password,
        cartData:cart,
    })
    await user.save();

    const data ={
        user:{
            id: user._id,
        }
    }

    const token= jwt.sign(data,'secret_ecom');
    res.json({
        success: true,
        token
    })
})


//Creating endpoint for user login 

app.post('/login',async(req,res)=>{
    let user=await Users.findOne({email:req.body.email});
    if(user)
    {
        const passCompare= req.body.password === user.password;
        if(passCompare){
            const data ={
                user:{
                    id:user.id
                }
            }
            const token= jwt.sign(data,'secret_ecom');
            res.json({
                success: true,
                token
            })
        }
        else{
            res.json({
                success: false,
                message: 'Invalid password'
            })
        }
    }
    else{
        res.json({
            success: false,
            message: 'Wrong Email address'
        })
    }
})

// Creating API for new colleection data 
app.get('/newcollections',async(req, res)=>{
    let products= await Product.find({});
    let newcollection= products.slice(1).slice(-8);
    
    res.send(newcollection);

})


// Creating API for popular in women data 
app.get('/popularinwomen',async(req, res)=>{
    let products= await Product.find({category:'women'});
    let popular_in_women= products.slice(0,4);
    
    res.send(popular_in_women);

})

//Creating middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) {
         res.status(401).send({ errors: "Please authenticate using a valid token" });
    }
    try {
        const data = jwt.verify(token, 'secret_ecom');
        req.user = data.user;
        next();
    } catch (error) {
        res.status(403).send({ errors: "Invalid token" });
    }
};

app.post('/addtocart', fetchUser, async (req, res) => {
    console.log("Added", req.body.itemId);
    let userData = await Users.findOne({ _id: req.user.id });
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.send("Added");
});


app.post('/removefromcart', fetchUser, async (req, res) => {
    console.log("Removed", req.body.itemId);
    let userData = await Users.findOne({ _id: req.user.id });
    if (userData.cartData[req.body.itemId] > 0) {
        userData.cartData[req.body.itemId] -= 1;
    }
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.send("Removed");
});


app.post('/getcart', fetchUser, async (req, res) => {
    console.log("Get Cart Request for User ID:", req.user.id); // Log user ID
    let userData = await Users.findOne({ _id: req.user.id });
    console.log("User Cart Data:", userData.cartData); // Log cart data
    res.send(userData.cartData);
});



  




app.listen(port, (error) => {
    if (!error) {
        console.log(`Server is running on port ${port}`);
    } else {
        console.log(`Error starting the server: ${error}`);
    }
});
