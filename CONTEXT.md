# Cin7 Core MCP

A read-only view of a Cin7 Core account's purchasing and inventory, offered to an AI assistant so a person can ask about stock and purchase orders.

## Language

**Purchase**:
A single buying document in Cin7 Core that carries the order to a supplier together with its receipts, invoices and credit notes.
_Avoid_: PO record, bill

**Simple Purchase**:
A Purchase with at most one receipt and one invoice.

**Advanced Purchase**:
A Purchase that can carry many receipts and many invoices.

**Stock level**:
The quantities of one product at one location, bin and batch: on hand, allocated, available and on order.
_Avoid_: Inventory count, product availability

**SKU**:
The product code shared between Cin7 Core and the client's sales data, used to match a product across the two.
_Avoid_: Product ID, item code

**Trial tenant**:
A temporary Cin7 Core account used to verify the server against the live API before the client's account is available.
_Avoid_: Sandbox, dev account
