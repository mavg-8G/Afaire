
import AppHeader from '@/components/layout/app-header';
import ActivityCalendarView from '@/components/calendar/activity-calendar-view';

export default function AppPage() {
  return (
    <div className="flex flex-col flex-grow min-h-screen">
      <AppHeader />
      <main className="flex-grow">
        <ActivityCalendarView />
      </main>
    </div>
  );
}
