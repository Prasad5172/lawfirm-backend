var express = require("express");
const cors = require("cors");
const app = express();


// Configure CORS to allow requests from http://localhost:3000
const corsOptions = {
  origin: 'http://localhost:3000',
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/", require("./routes/index.js"));


(async () => {
    console.log("hello server is running");
})();



app.listen(8000, () => {
  console.log("listening -" + 8000)
});