const express = require('express');
const app = express();
const port = 3000;
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});


app.post('/extract', upload.single('syllabus'), function (req, res, next) {
  // req.file is the `syllabus` file
  // req.body will hold the text fields, if there were any
  console.log(req.file)
  console.log(req.body)
  res.json({ message: req.file })
});