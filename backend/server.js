const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors');
  app.use(cors());
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const parser = require('./parser')
const extractEvents = require('./extractor');

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});


app.post('/extract', upload.single('syllabus'), async function (req, res, next) {

  const syllabusText = await parser(req.file.path)
  const jsonSyllabus = await extractEvents(syllabusText)

  return res.json(jsonSyllabus)
});
