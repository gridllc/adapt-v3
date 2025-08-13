CREATE OR REPLACE FUNCTION public.set_module_keys()
RETURNS trigger AS $$
BEGIN
  IF NEW."s3Key" IS NULL OR NEW."s3Key" = '' THEN
    NEW."s3Key" := 'videos/' || NEW.id || '.mp4';
  END IF;
  IF NEW."stepsKey" IS NULL OR NEW."stepsKey" = '' THEN
    NEW."stepsKey" := 'training/' || NEW.id || '.json';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_module_keys ON public.modules;
CREATE TRIGGER trg_set_module_keys
BEFORE INSERT ON public.modules
FOR EACH ROW EXECUTE FUNCTION public.set_module_keys();
