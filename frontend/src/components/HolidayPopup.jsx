import { CalendarDays, ShieldX } from 'lucide-react';

import UtilityPopup from './UtilityPopup';
import HolidayCalendar from '../pages/utilities/HolidayCalendar';
import { usePermissions } from '../context/PermissionContext';

/**
 * The holiday calendar, summoned by Alt+L.
 *
 * Renders the same component the full page does rather than a second calendar,
 * so marking a day behaves identically in both and neither can drift from the
 * other.
 *
 * Gated here rather than in the shortcut handler, which lives above the
 * permission provider and cannot see the grants.
 */
export default function HolidayPopup({ open, onClose }) {
  const { canView, isLoading } = usePermissions();
  const allowed = canView('MASTER_DATA');

  return (
    <UtilityPopup open={open} title="Holiday Calendar" icon={CalendarDays}
                  shortcut="Alt+L" size="calendar" onClose={onClose}>
      {isLoading ? (
        <div className="hc-loading">Checking access...</div>
      ) : allowed ? (
        <HolidayCalendar embedded />
      ) : (
        <div className="hc-noaccess">
          <ShieldX size={22} />
          <p>
            Your role does not include master data, so the holiday calendar is
            not available. An administrator can grant it from Roles &amp;
            Permissions.
          </p>
        </div>
      )}
    </UtilityPopup>
  );
}
