// frontend/src/pages/TrainingPage.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { logger } from "@utils/logger";
import { Navbar } from "@components/Navbar";

interface ModuleData {
  id: string;
  status: "UPLOADING" | "PROCESSING" | "READY" | "ERROR";
  stepsKey?: string;
}

interface Step {
  start: number;
  end: number;
  text: string;
}

const TrainingPage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [module, setModule] = useState<ModuleData | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const res = await fetch(`/api/modules/${moduleId}`);
        if (!res.ok) throw new Error("Failed to load module");
        const data: ModuleData = await res.json();
        setModule(data);

        if (data.status === "READY" && data.stepsKey) {
          const stepsRes = await fetch(data.stepsKey);
          if (!stepsRes.ok) throw new Error("Failed to load steps");
          const stepsData: Step[] = await stepsRes.json();
          setSteps(stepsData);
        }
      } catch (err) {
        logger.error("Error loading module:", err);
        setModule({ id: moduleId!, status: "ERROR" });
      } finally {
        setLoading(false);
      }
    };

    if (moduleId) fetchModule();
  }, [moduleId]);

  return (
    <>
      <Navbar />
      <div className="p-6">
        {loading ? (
          <div>Loading training module...</div>
        ) : !module ? (
          <div>Module not found</div>
        ) : module.status !== "READY" ? (
          <p className="text-gray-500">
            This module is currently {module.status.toLowerCase()}.
          </p>
        ) : steps.length === 0 ? (
          <p>No steps available.</p>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold mb-4">Training Module</h1>
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 border rounded bg-white shadow-sm"
                >
                  <p className="text-sm text-gray-700">
                    <strong>{step.start}s → {step.end}s</strong>: {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TrainingPage;
