import { Operation } from "@apollo/client";
import { decryptECIES, encryptECIES } from "blockstack/lib/encryption";
import dottie from "dottie";
import { createHmacs } from "./get-hmac";
import { getLocalKeyPair } from "./get-local-key-pair";

const PII = [
  "name",
  "address",
  "bornAddress",
  "gender",
  "linkedin",
  "wechat",
  "facebook",
  "github",
  "bornAt"
];

const NESTED_PII = ["emails", "phones"];

const { privateKey, publicKey } = getLocalKeyPair();

export class AdaptorDefault {
  name = "default";

  forward(operation: Operation): Operation {
    return operation;
  }

  map(response: any): any {
    return response;
  }
}

function decryptContact(contact: any): any {
  for (const pii of PII) {
    // @ts-ignore
    const piiVal = dottie.get(contact, pii) || "";
    if (piiVal) {
      let piiDec = piiVal;
      try {
        const val = JSON.parse(String(piiVal));
        piiDec = decryptECIES(privateKey, val);
        contact[pii] = piiDec;
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          window.console.error(`failed to decrypt: ${e}`);
        }
      }
    }
  }
  for (const pii of NESTED_PII) {
    // @ts-ignore
    const piiVal: Array<string> = dottie.get(contact, pii) || [];
    if (piiVal) {
      try {
        contact[pii] = piiVal.map(it => {
          return decryptECIES(privateKey, JSON.parse(it));
        });
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          window.console.error(`failed to decrypt: ${e}`);
        }
      }
    }
  }
  return contact;
}

function encryptContact(contact: any): any {
  contact.hmacs = createHmacs(contact.name, privateKey);

  for (const pii of PII) {
    // @ts-ignore
    const piiVal = dottie.get(contact, pii) || "";
    if (piiVal) {
      try {
        const cipherObj = encryptECIES(publicKey, String(piiVal));
        contact[pii] = JSON.stringify(cipherObj);
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          window.console.error(`failed to decrypt: ${e}`);
        }
      }
    }
  }

  for (const pii of NESTED_PII) {
    // @ts-ignore
    const piiVal: Array<string> = dottie.get(contact, pii) || [];
    if (piiVal) {
      try {
        contact[pii] = piiVal.map(it => {
          const cipherObj = encryptECIES(publicKey, it);
          return JSON.stringify(cipherObj);
        });
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          window.console.error(`failed to decrypt: ${e}`);
        }
      }
    }
  }

  return contact;
}

class AdaptorGeneral extends AdaptorDefault {
  name = "";

  forward(operation: Operation): Operation {
    let contact = dottie.get(operation, `variables.updateContactInput`) || {};
    contact = encryptContact(contact);
    dottie.set(operation, `variables.updateContactInput`, contact);
    return operation;
  }

  map(response: any): any {
    let contact = dottie.get(response, `data.${this.name}`);
    contact = decryptContact(contact);
    dottie.set(response, `data.${this.name}`, contact);
    return response;
  }
}

class AdaptorContacts extends AdaptorDefault {
  name = "contacts";

  map(response: any): any {
    const contacts = dottie.get(response, `data.${this.name}`) || [];
    const dec = [];
    // @ts-ignore
    for (const c of contacts) {
      dec.push(decryptContact(c));
    }
    dottie.set(response, `data.${this.name}`, contacts);
    return response;
  }
}

class AdaptorUpdateContact extends AdaptorGeneral {
  name = "updateContact";

  map(response: any): any {
    return response;
  }
}

class AdaptorContact extends AdaptorGeneral {
  name = "contact";

  forward(operation: Operation): Operation {
    return operation;
  }
}

class AdaptorCreateContact extends AdaptorGeneral {
  name = "createContact";

  forward(operation: Operation): Operation {
    let contact = dottie.get(operation, `variables.createContactInput`) || {};
    contact = encryptContact(contact);
    dottie.set(operation, `variables.createContactInput`, contact);
    return operation;
  }

  map(response: any): any {
    let contact = dottie.get(response, `data.${this.name}`);
    contact = decryptContact(contact);
    dottie.set(response, `data.${this.name}`, contact);
    return response;
  }
}

class AdaptorSearch extends AdaptorDefault {
  static decryptSearch(search: any): any {
    for (const it of search) {
      try {
        const val = JSON.parse(String(it.name));
        it.name = decryptECIES(privateKey, val);
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          window.console.error(`failed to decrypt: ${e}`);
        }
      }
    }
    return search;
  }

  name = "search";

  forward(operation: Operation): Operation {
    const search = operation.variables;
    search.hmacs = createHmacs(search.name, privateKey);
    return operation;
  }

  map(response: any): any {
    const { search } = response.data;
    response.data.search = AdaptorSearch.decryptSearch(search);
    return response;
  }
}

const adapterArray = [
  new AdaptorDefault(),
  new AdaptorUpdateContact(),
  new AdaptorContact(),
  new AdaptorContacts(),
  new AdaptorSearch(),
  new AdaptorCreateContact()
];

const adapters: Record<string, AdaptorDefault> = adapterArray.reduce(
  (acc, cur) => {
    acc[cur.name] = cur;
    return acc;
  },
  ({} as any) as Record<string, AdaptorDefault>
);

export function getAdapter(operation: Operation): AdaptorDefault {
  if (!privateKey) {
    return adapters.default;
  }
  return adapters[operation.operationName] || adapters.default;
}
