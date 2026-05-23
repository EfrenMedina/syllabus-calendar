import { FileUp, CalendarCheck, ArrowDownToLine } from 'lucide-react';

export default function StepIndicator({ currentStep }) {
    return(
        <>
            <div className='flex flex-row max-w-lg mx-auto'>
                <div className='flex flex-col items-center'>
                    <div className={`${currentStep >= 1 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-400'} p-3 rounded-xl`}>
                        <FileUp/> 
                    </div>
                    <div className='flex flex-col items-center text-xs uppercase text-gray-400'>
                        <label className='text-xs text-gray-400 mt-2'>Step 1</label>
                        <label className='text-sm font-semibold'>Upload Syllabus</label>
                    </div>
                </div>

                <div className={`flex-1 h-1 ${currentStep >= 2 ? 'bg-gray-900' : 'bg-gray-300'} mt-7 mx-2 rounded-full`} />

                <div className='flex flex-col items-center'>
                    <div className={`${currentStep >= 2 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-400'} p-3 rounded-xl`}>
                        <CalendarCheck/>
                    </div>
                    <div className='flex flex-col items-center text-xs uppercase text-gray-400'>
                        <label className='text-xs text-gray-400 mt-2'>Step 2</label>
                        <label className='text-sm font-semibold'>Review & Edit</label>
                    </div>
                </div>

                <div className={`flex-1 h-1 ${currentStep >= 3 ? 'bg-gray-900' : 'bg-gray-300'} mt-7 mx-2 rounded-full`} />

                <div className='flex flex-col items-center'>
                    <div className={`${currentStep == 3 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-400'} p-3 rounded-xl`}>
                        <ArrowDownToLine/>
                    </div>
                    <div className='flex flex-col items-center text-xs uppercase text-gray-400'>
                        <label className='text-xs text-gray-400 mt-2'>Step 3</label>
                        <label className='text-sm font-semibold'>Export Calendar</label>
                    </div>
                </div>
            </div>   
        </>
    )
}