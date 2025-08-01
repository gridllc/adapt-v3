import React, { useState } from 'react';
import { formatSeconds, parseTime, isValidTimeFormat } from '@/utils/timeUtils';

interface Step {
  id: string;
  text: string;
  start: number;
  end: number;
  aliases?: string[];
  notes?: string;
}

interface EditableStepProps {
  step: Step;
  index: number;
  onSeek: (time: number) => void;
  onSave: (updatedStep: Step) => void;
  onAIRewrite: (text: string) => Promise<string>; // Pass AI function
}

export const EditableStep: React.FC<EditableStepProps> = ({ 
  step, 
  index, 
  onSeek, 
  onSave, 
  onAIRewrite 
}) => {
  const [text, setText] = useState(step.text);
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(formatSeconds(step.start));
  const [end, setEnd] = useState(formatSeconds(step.end));
  const [aliases, setAliases] = useState(step.aliases?.join(', ') || '');
  const [notes, setNotes] = useState(step.notes || '');
  const [loadingAI, setLoadingAI] = useState(false);
  const [startError, setStartError] = useState('');
  const [endError, setEndError] = useState('');

  const handleSave = () => {
    // Validate time formats
    if (!isValidTimeFormat(start)) {
      setStartError('Invalid time format (use mm:ss)');
      return;
    }
    if (!isValidTimeFormat(end)) {
      setEndError('Invalid time format (use mm:ss)');
      return;
    }

    const startSeconds = parseTime(start);
    const endSeconds = parseTime(end);
    
    if (startSeconds >= endSeconds) {
      setEndError('End time must be after start time');
      return;
    }

    const updated: Step = {
      ...step,
      text,
      start: startSeconds,
      end: endSeconds,
      aliases: aliases.split(',').map(s => s.trim()).filter(Boolean),
      notes,
    };
    onSave(updated);
    setEditing(false);
    setStartError('');
    setEndError('');
  };

  const handleAIRewrite = async () => {
    setLoadingAI(true);
    try {
      const suggestion = await onAIRewrite(text);
      setText(suggestion);
    } catch (error) {
      console.error('AI rewrite failed:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleStartChange = (value: string) => {
    setStart(value);
    setStartError('');
  };

  const handleEndChange = (value: string) => {
    setEnd(value);
    setEndError('');
  };

  const handleCancel = () => {
    setText(step.text);
    setStart(formatSeconds(step.start));
    setEnd(formatSeconds(step.end));
    setAliases(step.aliases?.join(', ') || '');
    setNotes(step.notes || '');
    setEditing(false);
    setStartError('');
    setEndError('');
  };

  return (
    <div className="border rounded-xl p-4 mb-4 shadow-sm hover:shadow transition bg-white">
      <div className="flex justify-between items-center">
        <div>
          <button 
            onClick={() => onSeek(step.start)} 
            className="text-blue-600 hover:underline font-medium"
          >
            Step {index + 1} ({start} - {end})
          </button>
        </div>
        {!editing && (
          <button 
            onClick={() => setEditing(true)} 
            className="text-sm text-gray-600 hover:text-black px-2 py-1 rounded hover:bg-gray-100"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Step Description
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Describe this step..."
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                value={start}
                onChange={e => handleStartChange(e.target.value)}
                className={`w-full border p-2 text-sm rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  startError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="mm:ss"
              />
              {startError && (
                <p className="text-red-500 text-xs mt-1">{startError}</p>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                value={end}
                onChange={e => handleEndChange(e.target.value)}
                className={`w-full border p-2 text-sm rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  endError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="mm:ss"
              />
              {endError && (
                <p className="text-red-500 text-xs mt-1">{endError}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAIRewrite}
              disabled={loadingAI}
              className="text-xs bg-indigo-500 text-white px-3 py-2 rounded hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {loadingAI ? (
                <>
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  Thinking...
                </>
              ) : (
                <>
                  <span>🤖</span>
                  Rewrite with AI
                </>
              )}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aliases (other ways to reference this step)
            </label>
            <input
              value={aliases}
              onChange={e => setAliases(e.target.value)}
              placeholder="e.g., setup, initialization, first step"
              className="w-full border border-gray-300 p-2 text-sm rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated list of alternative names for this step
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Knowledge Box (teach AI more about this step)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add context, tips, or additional information that would help the AI understand this step better..."
              className="w-full border border-gray-300 p-2 text-sm rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
            />
            <p className="text-xs text-gray-500 mt-1">
              This information helps the AI provide better suggestions and understand the step context
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button 
              onClick={handleSave} 
              className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 font-medium"
            >
              Save Changes
            </button>
            <button 
              onClick={handleCancel} 
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <div className="text-sm text-gray-700 whitespace-pre-line mb-2">{text}</div>
          {aliases && (
            <div className="text-xs text-gray-500 mb-1">
              <span className="font-medium">Aliases:</span> {aliases}
            </div>
          )}
          {notes && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Notes:</span> {notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 