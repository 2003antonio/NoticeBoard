import { useCallback, useEffect, useRef, useState } from "react";

// Runs an async loader and tracks { data, loading, error }. Two things it gets
// right so screens do not have to:
//  - stale responses are ignored: if deps change (e.g. a filter) before an
//    earlier request returns, only the latest request is allowed to set state.
//  - errors a global handler already dealt with (401 logout, forced password
//    change) are not shown as a screen error, because we are redirecting anyway.
export function useLoader(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latest = useRef(0);

  const run = useCallback(() => {
    const requestId = ++latest.current;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(loader)
      .then((result) => {
        if (requestId === latest.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (requestId !== latest.current) return; // a newer request won
        setLoading(false);
        if (!err.handled) setError(err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    // Mark any in-flight request stale on unmount so it cannot set state.
    return () => {
      latest.current++;
    };
  }, [run]);

  return { data, loading, error, reload: run };
}
