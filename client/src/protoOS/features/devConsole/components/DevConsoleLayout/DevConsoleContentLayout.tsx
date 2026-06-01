import { ContentLayoutProps } from "@/protoOS/components/ContentLayout/types";

function DevConsoleContentLayout({ children }: ContentLayoutProps) {
  return (
    <div className="flex h-full justify-center p-8 tablet:p-6 phone:p-4">
      <div className="flex w-full max-w-[960px] flex-col">{children}</div>
    </div>
  );
}

export default DevConsoleContentLayout;
