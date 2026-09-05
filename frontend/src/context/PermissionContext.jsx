import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { rolesApi } from '../api';

const PermissionContext = createContext({
  modules: {},
  role: null,
  roleName: null,
  isLoading: true,
  canView: () => false,
  canEdit: () => false
});

/**
 * What the signed-in user may reach, fetched once per session.
 *
 * Nothing is assumed while it loads: `canView` returns false until the answer
 * arrives, so a restricted menu never flashes into view before being taken
 * away. The server enforces the same grants, so this only decides what is
 * offered — never what is allowed.
 */
export function PermissionProvider({ enabled, children }) {
  const [state, setState] = useState({ modules: {}, role: null, roleName: null });
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!enabled) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const data = await rolesApi.mine();
      setState({
        modules: data.modules || {},
        role: data.role,
        roleName: data.role_name
      });
    } catch {
      // Signed out or offline: grant nothing rather than everything.
      setState({ modules: {}, role: null, roleName: null });
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  const canView = useCallback(
    (module) => Boolean(state.modules[module]?.can_view), [state.modules]);
  const canEdit = useCallback(
    (module) => Boolean(state.modules[module]?.can_edit), [state.modules]);

  return (
    <PermissionContext.Provider
      value={{ ...state, isLoading, canView, canEdit, reload: load }}>
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionContext);
