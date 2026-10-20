import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './AuthContext';
import { canAdminister } from './roles';

// Holds the number of time-off (and contracted hours) requests waiting for an admin's decision.
// The nav bar (next to the username + on the ADMIN menu item) and the
// ADMIN page's Time Off tab all read from here, so they always agree.
// Non-admins always get 0 and we never call the admin-only endpoint for them.
const PendingTimeOffContext = createContext({ pendingCount: 0, refreshPending: () => {} });

export function PendingTimeOffProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = canAdminister(user); // time-off approvals are in the Admin area
  const [pendingCount, setPendingCount] = useState(0);

  // Moving between pages refreshes at most once a minute (it fired two
  // requests on every click before); an action calling refreshPending()
  // directly always refreshes.
  const lastRef = useRef(0);
  const refreshPending = useCallback(async ({ soft = false } = {}) => {
    if (!isAdmin) { setPendingCount(0); return; }
    if (soft && Date.now() - lastRef.current < 60 * 1000) return;
    lastRef.current = Date.now();
    // Time off plus contracted hours change requests: both wait in Admin → Time off.
    const [pending, hours] = await Promise.all([
      api.getAllTimeOffRequests('pending').catch(() => null),
      api.getHoursChangeRequests('pending').catch(() => []),
    ]);
    if (pending) setPendingCount(pending.length + (hours || []).length);
  }, [isAdmin]);

  // Re-check when the admin signs in and whenever they move between pages,
  // so a request someone submitted a moment ago shows up without a refresh.
  useEffect(() => { refreshPending({ soft: true }); }, [refreshPending, location.pathname]);

  return (
    <PendingTimeOffContext.Provider value={{ pendingCount, refreshPending }}>
      {children}
    </PendingTimeOffContext.Provider>
  );
}

export function usePendingTimeOff() {
  return useContext(PendingTimeOffContext);
}
