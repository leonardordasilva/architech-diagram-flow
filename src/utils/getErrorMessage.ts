/**
 * Safely extracts a human-readable message from an unknown error value.
 * Use in every catch block instead of `(err: any) => err.message`.
 * @ref PRD-0028 F1-T1
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Unknown error';
}
