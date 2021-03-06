import { t } from "onefx/lib/iso-i18n";
import * as React from "react";
import router, { Route, RouteComponentProps } from "react-router";

import { ErrorPage } from "./error-page";

const Status = ({ code, children }: Props): JSX.Element => (
  <Route
    render={({
      staticContext
    }: RouteComponentProps<
      Record<string, undefined>,
      router.StaticContext
    >) => {
      if (staticContext) {
        staticContext.statusCode = code;
      }
      return children;
    }}
  />
);

export function NotFound(): JSX.Element {
  return (
    <Status code={404}>
      <ErrorPage
        bar={t("not_found.bar")}
        title={t("not_found.title")}
        info={t("not_found.info")}
      />
    </Status>
  );
}

type Props = {
  code: number;
  children: Array<JSX.Element> | JSX.Element;
};
