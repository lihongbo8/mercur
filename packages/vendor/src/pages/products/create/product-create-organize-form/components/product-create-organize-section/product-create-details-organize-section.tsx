import { useState } from "react";

import { Heading, Text } from "@medusajs/ui";

import { Form } from "@components/common/form";
import { Combobox } from "@components/inputs/combobox";
import { useComboboxData } from "@hooks/use-combobox-data";
import { sdk, fetchQuery } from "@lib/client";
import { useTabbedForm } from "@components/tabbed-form";
import { ProductCreateSchemaType } from "../../../types";
import { CategoryCombobox } from "@pages/products/common/components/category-combobox";

export const ProductCreateOrganizationSection = () => {
  const form = useTabbedForm<ProductCreateSchemaType>();
  const rolePackageId = form.watch("role_package_id");
  const rolePackageVersion = form.watch("role_package_version");
  const roleCategory = form.watch("role_category");
  const isAicsRoleListing = Boolean(rolePackageId && rolePackageVersion);

  const collections = useComboboxData({
    queryKey: ["product_collections"],
    queryFn: (params) =>
      sdk.vendor.collections.query({ offset: 0, limit: 100, ...params }),
    getOptions: (data) =>
      data.collections.map((collection: any) => ({
        label: collection.title!,
        value: collection.id!,
      })),
  });

  const types = useComboboxData({
    queryKey: ["product_types", "creating"],
    queryFn: (params) =>
      fetchQuery("/vendor/product-types", {
        method: "GET",
        query: params,
      }),
    getOptions: (data) =>
      data.product_types.map((type: any) => ({
        label: type.value,
        value: type.id,
      })),
  });

  const tags = useComboboxData({
    queryKey: ["product_tags", "creating"],
    queryFn: (params) =>
      fetchQuery("/vendor/product-tags", {
        method: "GET",
        query: params,
      }),
    getOptions: (data) =>
      data.product_tags.map((tag: any) => ({
        label: tag.value,
        value: tag.id,
      })),
  });

  return (
    <div id="organize" className="flex flex-col gap-y-8">
      <Heading>归属设置</Heading>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Form.Field
          control={form.control}
          name="tags"
          render={({ field }) => {
            return (
              <Form.Item>
                <Form.Label optional>关键词</Form.Label>
                <Form.Control>
                  <Combobox
                    {...field}
                    options={tags.options}
                    searchValue={tags.searchValue}
                    onSearchValueChange={tags.onSearchValueChange}
                    fetchNextPage={tags.fetchNextPage}
                  />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            );
          }}
        />
        <Form.Field
          control={form.control}
          name="type_id"
          render={({ field }) => {
            return (
              <Form.Item>
                <Form.Label optional>岗位类型</Form.Label>
                <Form.Control>
                  <Combobox
                    {...field}
                    options={types.options}
                    searchValue={types.searchValue}
                    onSearchValueChange={types.onSearchValueChange}
                    fetchNextPage={types.fetchNextPage}
                    allowClear
                  />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            );
          }}
        />
      </div>
      {isAicsRoleListing ? (
        <div className="rounded-md border border-ui-border-base bg-ui-bg-base px-4 py-3">
          <Text size="small" weight="plus">
            岗位分类
          </Text>
          <Text size="small" className="mt-1 text-ui-fg-subtle">
            {roleCategory || "未选择"}。AICS 岗位商品使用岗位分类进入审核、商城和使用者中心，不再绑定普通商品主分类。
          </Text>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Field
            control={form.control}
            name="categories"
            render={({ field }) => {
              const [isFocused, setIsFocused] = useState(false);

              return (
                <Form.Item>
                  <Form.Label tooltip="用于商城前台归类展示。">
                    主分类
                  </Form.Label>
                  <Form.Control>
                    <CategoryCombobox
                      {...field}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => {
                        setIsFocused(false);
                        field.onBlur();
                      }}
                      isSingleSelect
                      allowClear={false}
                    />
                  </Form.Control>
                  {!isFocused && <Form.ErrorMessage />}
                </Form.Item>
              );
            }}
          />
          <Form.Field
            control={form.control}
            name={"secondary_categories" as any}
            render={({ field }) => {
              return (
                <Form.Item>
                  <Form.Label optional>辅助分类</Form.Label>
                  <Form.Control>
                    <CategoryCombobox
                      {...field}
                      value={field.value || []}
                    />
                  </Form.Control>
                  <Form.ErrorMessage />
                </Form.Item>
              );
            }}
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Form.Field
          control={form.control}
          name="collection_id"
          render={({ field }) => {
            return (
              <Form.Item>
                <Form.Label optional>岗位分组</Form.Label>
                <Form.Control>
                  <Combobox
                    {...field}
                    options={collections.options}
                    searchValue={collections.searchValue}
                    onSearchValueChange={collections.onSearchValueChange}
                    fetchNextPage={collections.fetchNextPage}
                    allowClear
                  />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            );
          }}
        />
      </div>
    </div>
  );
};
