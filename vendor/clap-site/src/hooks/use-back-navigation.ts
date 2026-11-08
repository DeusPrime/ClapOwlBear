import { useLocation, useNavigate } from 'react-router-dom';

export function useBackNavigation(fallback: string) {
  const location = useLocation();
  const navigate = useNavigate();
  return () => {
    const state = location.state;
    const target = state?.returnTo;
    if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && target !== location.pathname + location.search) {
      navigate(target, { replace: true, state: state.returnState ?? null });
    } else if (state?.resourceOrigin) navigate(fallback, { replace: true });
    else if (window.history.state?.idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
