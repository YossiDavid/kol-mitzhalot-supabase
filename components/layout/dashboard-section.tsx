import Section from "./section";
import { cn } from "@/lib/utils";

type DashboardSectionProps = {
  children: React.ReactNode;
  title: string;
  titleNumber?: string | number;
  subTitle?: string;
  button: React.ReactElement;
  className?: string;
  containerClassName?: string;
  headClassName?: string;
};

export default function DashboardSection({
  children,
  ...props
}: DashboardSectionProps) {
  return (
    <Section
      className={props.className}
      containerClassName={props.containerClassName}
    >
      <div
        className={cn(
          "col-span-full mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
          props.headClassName,
        )}
      >
        <div>
          <h2>
            {props.title}
            {props.titleNumber && (
              <span className="text-base"> ({`${props.titleNumber}`})</span>
            )}
          </h2>
          <p>{props.subTitle}</p>
        </div>
        {props.button}
      </div>
      {children}
    </Section>
  );
}
