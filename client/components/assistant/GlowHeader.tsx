/**
 * GlowHeader.tsx
 * Used to show the header for the chat widget and dialog
 * @AshokSaravanan222 & @siladiea
 * 07-16-2025
 */

export default function GlowHeader() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center relative">
          <span className="text-white font-bold text-lg z-10">G</span>
        </div>
        <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-blue-500 bg-clip-text text-transparent">
          GLOW Assistant
        </h3>
      </div>
      <p className="text-base text-muted-foreground max-w-2xl mx-auto">
        Get insights about student performance, generate reports, and analyze
        training data with our intelligent assistant
      </p>
    </div>
  );
}
