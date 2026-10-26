import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { FormErrorInfo } from "@/lib/formApiErrors";

/** Stays visible until corrected or retried (unlike a short-lived toast). */
export function FormErrorNotice({ error }: { error: FormErrorInfo }) {
  return (
    <Alert variant="destructive" className="mb-4" role="alert" aria-live="polite">
      <AlertTitle>Unable to save</AlertTitle>
      <AlertDescription>
        <p>{error.summary}</p>
        {error.details.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {error.details.map((detail, index) => <li key={`${index}-${detail}`}>{detail}</li>)}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
