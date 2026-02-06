import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        {/* Mobile top spacing */}
        <div className="lg:hidden h-14" />

        {/* Content area */}
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
