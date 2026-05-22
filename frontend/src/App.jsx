import { useState } from "react"

function App(){
  const [file, setFile] = useState(null);

  return(
    <div>
      <h1>Syllabus Calendar</h1>
      <p>Upload your syllabus to extract events.</p>
      <input type="file" accept="pdf"/>
      <button>Upload Syllabus</button>
    </div>
  )
}

export default App