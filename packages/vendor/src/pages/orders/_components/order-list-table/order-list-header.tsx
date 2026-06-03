import { Children, ReactNode } from "react";
import { Heading } from "@medusajs/ui";

export const OrderListTitle = () => {
  return <Heading>销售记录</Heading>;
};

export const OrderListActions = ({
  children,
}: {
  children?: ReactNode;
}) => {
  return (
    <div className="flex items-center justify-center gap-x-2">
      {Children.count(children) > 0 ? children : null}
    </div>
  );
};

export const OrderListHeader = ({
  children,
}: {
  children?: ReactNode;
}) => {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      {Children.count(children) > 0 ? (
        children
      ) : (
        <OrderListTitle />
      )}
    </div>
  );
};
