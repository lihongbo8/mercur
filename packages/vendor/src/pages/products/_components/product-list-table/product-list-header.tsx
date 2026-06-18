import { Children, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Heading } from "@medusajs/ui";

export const ProductListTitle = () => {
  return <Heading level="h2">岗位商品</Heading>;
};

export const ProductListCreateButton = () => {
  return (
    <Button size="small" variant="primary" asChild>
      <Link to="create" title="上传资料包并创建岗位商品">
        新建
      </Link>
    </Button>
  );
};

export const ProductListActions = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="flex items-center justify-center gap-x-2">
      {Children.count(children) > 0 ? (
        children
      ) : (
        <>
          <ProductListCreateButton />
        </>
      )}
    </div>
  );
};

export const ProductListHeader = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      {Children.count(children) > 0 ? (
        children
      ) : (
        <>
          <ProductListTitle />
          <ProductListActions />
        </>
      )}
    </div>
  );
};
