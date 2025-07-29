import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { API_CONFIG, API_ENDPOINTS } from '../config/api'

interface Step {
  stepTitle: string
  text: string
  timestamp?: number
}

export const EditStepsPage: React.FC = () => {
  const { moduleId } = useParams();
  const [transcript, setTranscript] = useState<string>('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>({ stepTitle: '', text: '', timestamp: undefined });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!moduleId) return;
    fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.TRANSCRIPT(moduleId)))
      .then(res => res.json())
      .then(data => {
        setTranscript(data.transcript || '');
      })
      .finally(() => setLoading(false));
  }, [moduleId]);

  const addStep = () => {
    if (!currentStep.stepTitle || !currentStep.text) return;
    setSteps(prev => [...prev, currentStep]);
    setCurrentStep({ stepTitle: '', text: '', timestamp: undefined });
  };

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    setSteps(newSteps);
  };

  const saveSteps = async () => {
    await fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.STEPS(moduleId!)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps }),
    });
    alert('Steps saved!');
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Edit Training Steps</h1>
      
      {loading ? (
        <div className="text-center">Loading transcript...</div>
      ) : (
        <div className="space-y-6">
          {/* Transcript Display */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Transcript</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{transcript}</p>
          </div>

          {/* Step Editor */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Steps</h2>
            
            {/* Add New Step */}
            <div className="bg-white p-4 border rounded-lg space-y-3">
              <h3 className="font-medium">Add New Step</h3>
              <input
                type="text"
                placeholder="Step Title"
                value={currentStep.stepTitle}
                onChange={(e) => setCurrentStep(prev => ({ ...prev, stepTitle: e.target.value }))}
                className="w-full p-2 border rounded"
              />
              <textarea
                placeholder="Step Description"
                value={currentStep.text}
                onChange={(e) => setCurrentStep(prev => ({ ...prev, text: e.target.value }))}
                className="w-full p-2 border rounded h-20"
              />
              <input
                type="number"
                placeholder="Timestamp (seconds)"
                value={currentStep.timestamp || ''}
                onChange={(e) => setCurrentStep(prev => ({ ...prev, timestamp: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={addStep}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Add Step
              </button>
            </div>

            {/* Existing Steps */}
            {steps.map((step, index) => (
              <div key={index} className="bg-white p-4 border rounded-lg space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium">{step.stepTitle}</h4>
                    <p className="text-sm text-gray-600">{step.text}</p>
                    {step.timestamp !== undefined && (
                      <p className="text-xs text-gray-500">Timestamp: {step.timestamp}s</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                      className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                      className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeStep(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Save Button */}
            {steps.length > 0 && (
              <button
                onClick={saveSteps}
                className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
              >
                Save Steps
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};