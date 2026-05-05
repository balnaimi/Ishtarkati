import React, { type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[Ishtarkati render]", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          dir="rtl"
          className="flex min-h-full flex-col items-center justify-center gap-4 bg-cream-100 p-8 text-center text-cream-900"
        >
          <p className="text-lg font-semibold">حدث خطأ غير متوقّع في الواجهة</p>
          <p className="max-w-md text-sm leading-relaxed text-cream-800">
            يمكنك إعادة تحميل التطبيق. إن تكرّر الخطأ بعد التحديث، أعد تشغيل البرنامج.
          </p>
          <button type="button" className="sk-btn-primary" onClick={() => window.location.reload()}>
            إعادة تحميل
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
