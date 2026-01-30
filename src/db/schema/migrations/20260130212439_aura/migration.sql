-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TicketDetail" (
    "idTicketDetail" TEXT NOT NULL PRIMARY KEY,
    "eventID" TEXT NOT NULL,
    "ticketID" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "document" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "TicketDetail_eventID_fkey" FOREIGN KEY ("eventID") REFERENCES "Event" ("idEvent") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketDetail_ticketID_fkey" FOREIGN KEY ("ticketID") REFERENCES "Ticket" ("idTicket") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TicketDetail" ("amount", "document", "eventID", "firstName", "idTicketDetail", "lastName", "ticketID") SELECT "amount", "document", "eventID", "firstName", "idTicketDetail", "lastName", "ticketID" FROM "TicketDetail";
DROP TABLE "TicketDetail";
ALTER TABLE "new_TicketDetail" RENAME TO "TicketDetail";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
