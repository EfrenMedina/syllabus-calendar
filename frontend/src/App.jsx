import { useState } from "react"
import ExportStep from "./components/ExportStep"
import ReviewStep from "./components/ReviewStep"
import UploadStep from "./components/UploadStep"

function App(){
  const [step, setStep] = useState(1)
  const [events, setEvents] = useState(null)

  switch (step) {
    case 1:
      return <UploadStep currentStep={step} onUpload={handleEventsRecieved}/>
    case 2:
      console.log(events)
      return <ReviewStep currentStep={step}/>
    case 3:
      return <ExportStep currentStep={step}/>
  }

  function handleEventsRecieved(eventsData){
    setEvents(eventsData);
    setStep(2);
  }
}

export default App