import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, API_ENDPOINTS } from '../config/api';
import { EditableStep } from '@components/EditableStep';
import { logger } from '@utils/logger';
import { Navbar } from '@/components/Navbar';

interface Step {
  id: string;
  text: string;
  start: number;
  end: number;
  aliases?: string[];
  notes?: string;
}

export default function EditStepsPage() {
  const { moduleId } = useParams();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!moduleId) return;
    setLoading(true);
    api(API_ENDPOINTS.STEPS(moduleId))
      .then((data) => {
        const transformed = (data.steps || []).map((step: any, index: number): Step => ({
          id: step.id || `step-${index}`,
          text: step.title || step.text || step.description || '',
          start: step.timestamp || step.start || 0,
          end: (step.timestamp || step.start || 0) + (step.duration || 30),
          aliases: step.aliases || [],
          notes: step.notes || ''
        }));
        setSteps(transformed);
      })
      .catch((err) => {
        logger.error('Failed to load steps:', err);
        setError('Failed to load steps');
      })
      .finally(() => setLoading(false));
  }, [moduleId]);

  const handleSaveStep = async (updatedStep: Step, index: number) => {
    const updatedSteps = [...steps];
    updatedSteps[index] = updatedStep;
    setSteps(updatedSteps);

    try {
      await api(`/api/steps/${moduleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: updatedSteps })
      });
    } catch (err) {
      logger.error('Step save failed:', err);
    }
  };

  const handleAIRewrite = async (text: string): Promise<string> => {
    try {
      const response = await api(`/api/steps/${moduleId}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      return response.rewritten || '';
    } catch (err) {
      logger.error('Rewrite failed:', err);
      return text;
    }
  };

  return (
    <>
      <Navbar />
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Edit Training Steps</h1>
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {steps.map((step, index) => (
          <EditableStep
            key={step.id}
            step={step}
            index={index}
            onSeek={(time: number) => {/* TODO: implement seek */}}
            onSave={(updated) => handleSaveStep(updated, index)}
            onAIRewrite={handleAIRewrite}
          />
        ))}
      </div>
    </>
  );
}
