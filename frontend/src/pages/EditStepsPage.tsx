import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface Step {
  stepTitle: string;
  text: string;
  timestamp?: number;
}

export const EditStepsPage: React.FC = () => {
  const { moduleId } = useParams();
  const [transcript, setTranscript] = useState<string>('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>({ stepTitle: '', text: '', timestamp: undefined });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!moduleId) return;
    fetch(`/api/transcript/${moduleId}`)
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
    await fetch(`/api/steps/${moduleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps }),
    });
    alert('Steps saved!');
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-4">Edit Steps for Module: {moduleId}</h1>

      {loading ? (
        <p>Loading transcript...</p>
      ) : (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Transcript</h2>
          <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
            {transcript}
          </pre>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Add New Step</h2>
        <input
          type="text"
          placeholder="Step Title"
          className="w-full border px-3 py-2 rounded mb-2"
          value={currentStep.stepTitle}
          onChange={e => setCurrentStep({ ...currentStep, stepTitle: e.target.value })}
        />
        <textarea
          placeholder="Step Instructions"
          className="w-full border px-3 py-2 rounded mb-2"
          rows={3}
          value={currentStep.text}
          onChange={e => setCurrentStep({ ...currentStep, text: e.target.value })}
        />
        <input
          type="number"
          placeholder="Timestamp (seconds)"
          className="w-full border px-3 py-2 rounded mb-2"
          value={currentStep.timestamp || ''}
          onChange={e => setCurrentStep({ ...currentStep, timestamp: parseFloat(e.target.value) || undefined })}
        />
        <button
          onClick={addStep}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Step
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Steps</h2>
        {steps.map((step, index) => (
          <div key={index} className="bg-white border p-4 rounded mb-2">
            <div className="flex justify-between">
              <div>
                <strong>{step.stepTitle}</strong>
                {step.timestamp !== undefined && (
                  <span className="ml-2 text-sm text-gray-500">({step.timestamp}s)</span>
                )}
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{step.text}</p>
              </div>
              <div className="space-x-2">
                <button onClick={() => moveStep(index, 'up')} className="text-blue-500 text-sm">↑</button>
                <button onClick={() => moveStep(index, 'down')} className="text-blue-500 text-sm">↓</button>
                <button onClick={() => removeStep(index)} className="text-red-500 text-sm">✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={saveSteps}
        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
      >
        Save All Steps
      </button>
    </div>
  );
};