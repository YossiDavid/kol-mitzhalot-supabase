import { cn } from "@/lib/utils";

type DashboardSectionProps = {
  children: React.ReactNode;
  title: string;
  titleNumber?: string | number;
  subTitle?: string;
  button?: React.ReactElement;
  className?: string;
  containerClassName?: string;
  headClassName?: string;
};

export default function DashboardSection({
  children,
  ...props
}: DashboardSectionProps) {
  return (
    <section className={cn(props.className, props.containerClassName)}>
      <div
        className={cn(
          "col-span-full mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
          props.headClassName,
        )}
      >
        <div>
          <h2 className="text-subtitle md:text-title">
            {props.title}
            {props.titleNumber && Number(props.titleNumber) > 0 && (
              <span className="ms-1.5 font-normal">
                {`(${props.titleNumber})`}
              </span>
            )}
          </h2>
          {props.subTitle && (
            <p className="text-muted-foreground mt-0.5 text-body-sm">
              {props.subTitle}
            </p>
          )}
        </div>
        {props.button ?? null}
      </div>
      {children}
    </section>
  );
}
