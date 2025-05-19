
import AppHeader from '@/components/layout/app-header';
import KanbanBoard from '@/components/kanban/kanban-board';

export default function AppPage() {
  return (
    <div className="flex flex-col flex-grow">
      <AppHeader />
      <main className="flex-grow">
        <KanbanBoard />
      </main>
    </div>
  );
}
