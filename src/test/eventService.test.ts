import { EventService } from "../services/eventService";
import { EventRepository } from "../repositories/eventRepository";
import { TicketRepository } from "../repositories/ticketRepository";
import { TicketDetailRepository } from "../repositories/ticketDetailRepository";
import { BalanceService } from "../services/balanceService";
import { AuthorizationService } from "../services/authorizationService";
import { Ticket, Event, TicketDetail } from "@prisma/client";
import { TokenData } from "../types/auth";

export enum EventCategory {
    CUMPLEAÑOS = "CUMPLEAÑOS",
    DEPORTE = "DEPORTE",
    CONCIERTO = "CONCIERTO",
    CASUAL = "CASUAL",
    SOCIAL = "SOCIAL",
    FIESTA = "FIESTA",
    OTRO = "OTRO",
}

jest.mock("../repositories/eventRepository");
jest.mock("../repositories/ticketRepository");
jest.mock("../repositories/ticketDetailRepository");
jest.mock("../services/balanceService");
jest.mock("../services/authorizationService");

describe("EventService tests ready to run", () => {
  let service: EventService;
  const token: TokenData = { userId: "user1", username: "john_doe" };

  const mockEventRepo = EventRepository as jest.Mocked<typeof EventRepository>;
  const mockTicketRepo = TicketRepository as jest.Mocked<typeof TicketRepository>;
  const mockTicketDetailRepo = TicketDetailRepository as jest.Mocked<typeof TicketDetailRepository>;
  const mockBalanceService = BalanceService as jest.Mocked<typeof BalanceService>;
  const mockAuthService = AuthorizationService as jest.Mocked<typeof AuthorizationService>;

  // Dummy Event con category
  const dummyEvent = {
    idEvent: "ev1",
    title: "Mi Evento",
    date: new Date(),
    description: "Desc",
    shortDescription: "Corta",
    direction: "Dir",
    creatorID: "user1",
    free: true,
    category: EventCategory.OTRO,
    assistants: 0,
    cancelled: false,
    price: null,
    completed: false,
    imageURL: null,
  } as unknown as Event;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventService();

    // mock addAssistant para devolver un Event válido
    mockEventRepo.addAssistant.mockImplementation(async () => dummyEvent);
  });

  // ACCESS EVENT - FREE
  it("should allow access to a free event", async () => {
    const event = { ...dummyEvent, free: true } as unknown as Event;
    const ticket = {
      idTicket: "t1",
      idEvent: "ev1",
      idUser: "user1",
      amount: 0,
      participants: 1,
    } as unknown as Ticket;

    mockEventRepo.getEventById.mockResolvedValue(event);
    mockTicketRepo.createTicket.mockResolvedValue(ticket);
    mockTicketDetailRepo.createTicketDetail.mockResolvedValue({
      idTicketDetail: "d1",
      eventID: "ev1",
      ticketID: "t1",
      firstName: "John",
      lastName: "Doe",
      document: 123,
      amount: 0,
    } as unknown as TicketDetail);

    const participantsDetails = [{ firstName: "John", lastName: "Doe", document: 123 }];

    const result = await service.accessEvent(token, event.idEvent, 1, participantsDetails);

    expect(mockEventRepo.getEventById).toHaveBeenCalledWith("ev1");
    expect(mockTicketRepo.createTicket).toHaveBeenCalledWith("user1", "ev1", 1, 0);
    expect(mockEventRepo.addAssistant).toHaveBeenCalledWith(1, "ev1");
    expect(result).toEqual(ticket);
  });

  it("should throw if event already completed", async () => {
    const event = { ...dummyEvent, completed: true } as Event;
    mockEventRepo.getEventById.mockResolvedValue(event);

    await expect(service.accessEvent(token, "ev1", 1, [])).rejects.toThrow(
      "El evento ya ha finalizado"
    );
  });

  // ACCESS EVENT - PAID
  it("should allow access to a paid event and charge user", async () => {
    const paidEvent = { ...dummyEvent, free: false, price: 50 } as Event;
    const ticket = {
      idTicket: "tx-paid",
      idEvent: paidEvent.idEvent,
      idUser: "user1",
      amount: 100,
      participants: 2,
    } as Ticket;

    mockEventRepo.getEventById.mockResolvedValue(paidEvent);
    mockBalanceService.pay.mockResolvedValue(undefined as any);
    mockTicketRepo.createTicket.mockResolvedValue(ticket);
    mockTicketDetailRepo.createTicketDetail.mockResolvedValue({
      idTicketDetail: "dt1",
      eventID: paidEvent.idEvent,
      ticketID: "tx-paid",
      firstName: "John",
      lastName: "Doe",
      document: 123,
      amount: 50,
    } as unknown as TicketDetail);

    const result = await service.accessEvent(token, paidEvent.idEvent, 2, [
      { firstName: "John", lastName: "Doe", document: 123 },
    ]);

    expect(mockBalanceService.pay).toHaveBeenCalledWith(token, 100);
    expect(mockTicketRepo.createTicket).toHaveBeenCalledWith("user1", paidEvent.idEvent, 2, 100);
    expect(mockEventRepo.addAssistant).toHaveBeenCalledWith(2, paidEvent.idEvent);
    expect(result).toEqual(ticket);
  });

  it("should throw if user cannot pay for paid event", async () => {
    const paidEvent = { ...dummyEvent, free: false, price: 50 } as Event;

    mockEventRepo.getEventById.mockResolvedValue(paidEvent);
    mockBalanceService.pay.mockRejectedValue(new Error("Saldo insuficiente"));

    await expect(
      service.accessEvent(token, paidEvent.idEvent, 1, [
        { firstName: "John", lastName: "Doe", document: 123 },
      ])
    ).rejects.toThrow("Saldo insuficiente");
  });

  // LEAVE EVENT
  it("should allow leaving a free event", async () => {
    const event = { ...dummyEvent, free: true } as Event;
    const ticket = {
      idTicket: "t1",
      idEvent: "ev1",
      idUser: "user1",
      participants: 1,
    } as Ticket;

    mockTicketRepo.getTicket.mockResolvedValue(ticket);
    mockEventRepo.getEventById.mockResolvedValue(event);
    mockAuthService.assertParticipant.mockResolvedValue(undefined as any);

    await service.leaveEvent(token, ticket.idTicket);

    expect(mockTicketRepo.deleteTicket).toHaveBeenCalledWith("t1");
    expect(mockEventRepo.addAssistant).toHaveBeenCalledWith(-1, "ev1");
  });

  it("should throw when trying to leave a paid event", async () => {
    const paidEvent = { ...dummyEvent, free: false, price: 100 } as Event;
    const ticket = {
      idTicket: "t1",
      idEvent: "ev1",
      idUser: "user1",
    } as Ticket;

    mockTicketRepo.getTicket.mockResolvedValue(ticket);
    mockEventRepo.getEventById.mockResolvedValue(paidEvent);

    await expect(service.leaveEvent(token, ticket.idTicket)).rejects.toThrow(
      "No se puede salir de un evento pago"
    );
  });

  // CREATE EVENT - FREE
  it("should create event and register creator", async () => {
    const createdEvent = { ...dummyEvent, idEvent: "ev2", free: true } as Event;
    const ticket = {
      idTicket: "t2",
      idEvent: "ev2",
      idUser: "user1",
    } as Ticket;

    mockEventRepo.createEvent.mockResolvedValue(createdEvent);
    mockTicketRepo.createTicket.mockResolvedValue(ticket);
    mockTicketDetailRepo.createTicketDetail.mockResolvedValue({
      idTicketDetail: "d2",
      ticketID: "t2",
      eventID: "ev2",
      firstName: "John",
      lastName: "Doe",
      document: 111,
      amount: 0,
    } as unknown as TicketDetail);

    (service["userService"].getUserById as any) = jest.fn().mockResolvedValue({
      firstName: "John",
      lastName: "Doe",
      document: 111,
    });

    const result = await service.createEvent(
      token,
      "title",
      "desc",
      "short",
      "dir",
      new Date(),
      null,
      true,
      null,
      EventCategory.OTRO
    );

    expect(mockEventRepo.createEvent).toHaveBeenCalled();
    expect(mockTicketRepo.createTicket).toHaveBeenCalledWith("user1", "ev2", 1, 0);
    expect(mockEventRepo.addAssistant).toHaveBeenCalledWith(1, "ev2");
    expect(result).toEqual(createdEvent);
  });

  // CREATE EVENT - PAID and errors
  it("should create a paid event including price", async () => {
    const createdPaidEvent = { ...dummyEvent, idEvent: "ev-paid", free: false, price: 200 } as Event;
    const ticket = {
      idTicket: "creator-ticket",
      idEvent: "ev-paid",
      idUser: "user1",
    } as Ticket;

    mockEventRepo.createEvent.mockResolvedValue(createdPaidEvent);
    (service["userService"].getUserById as any) = jest.fn().mockResolvedValue({
      firstName: "Alice",
      lastName: "Doe",
      document: 555,
    });
    mockTicketRepo.createTicket.mockResolvedValue(ticket);
    mockTicketDetailRepo.createTicketDetail.mockResolvedValue({} as TicketDetail);

    const result = await service.createEvent(
      token,
      "Evento Pago",
      "Descripción",
      "Corta",
      "Lugar",
      new Date(),
      200,
      false,
      null,
      EventCategory.DEPORTE
    );

    expect(mockEventRepo.createEvent).toHaveBeenCalledWith(
      "Evento Pago",
      "Descripción",
      "Corta",
      "Lugar",
      expect.any(Date),
      200,
      false,
      "user1",
      null,
      EventCategory.DEPORTE
    );

    expect(result).toEqual(createdPaidEvent);
  });

  it("should throw when event creation fails", async () => {
    mockEventRepo.createEvent.mockRejectedValue(new Error("DB failure"));

    await expect(
      service.createEvent(
        token,
        "Bad Event",
        "Desc",
        "Short",
        "Dir",
        new Date(),
        null,
        true,
        null,
        EventCategory.CASUAL
      )
    ).rejects.toThrow("DB failure");
  });

  // DELETE EVENT
  it("should delete event with admin permission", async () => {
    const event = { ...dummyEvent } as Event;

    mockEventRepo.getEventById.mockResolvedValue(event);
    mockAuthService.assertAdmin.mockResolvedValue(undefined as any);
    mockEventRepo.deleteEvent.mockResolvedValue(event);

    const result = await service.deleteEvent(token, event.idEvent);

    expect(mockAuthService.assertAdmin).toHaveBeenCalledWith(token, event.idEvent);
    expect(mockEventRepo.deleteEvent).toHaveBeenCalledWith(event.idEvent);
    expect(result).toEqual(event);
  });

  // DUPLICATE PARTICIPANT TEST
  it("should throw when trying to add a participant with duplicate document", async () => {
    const event = { ...dummyEvent, free: true } as Event;
    const ticket = {
      idTicket: "t1",
      idEvent: "ev1",
      idUser: "user1",
      amount: 0,
      participants: 1,
    } as Ticket;

    const participant = { firstName: "John", lastName: "Doe", document: 123 };

    // Primer llamado: participante no existe
    mockEventRepo.getEventById.mockResolvedValue(event);
    mockTicketRepo.createTicket.mockResolvedValue(ticket);
    mockTicketDetailRepo.getDetailByDocumentAndEvent.mockResolvedValueOnce(null);
    mockTicketDetailRepo.createTicketDetail.mockResolvedValue({
      idTicketDetail: "d1",
      eventID: "ev1",
      ticketID: "t1",
      firstName: "John",
      lastName: "Doe",
      document: 123,
      amount: 0,
    } as unknown as TicketDetail);

    const result = await service.accessEvent(token, event.idEvent, 1, [participant]);
    expect(result).toEqual(ticket);

    // Segundo intento con mismo DNI
    mockTicketDetailRepo.getDetailByDocumentAndEvent.mockResolvedValueOnce(
      {} as unknown as TicketDetail
    );

    await expect(service.accessEvent(token, event.idEvent, 1, [participant])).rejects.toThrow(
      "Un participante ya asiste al evento"
    );
  });

  // LEAVE EVENT EXTRA CASES
  it("should throw if user tries to leave an event with someone else's ticket", async () => {
    const event = { ...dummyEvent, free: true } as Event;
    const ticket = {
      idTicket: "t1",
      idEvent: "ev1",
      idUser: "ANOTHER_USER",
      participants: 1,
    } as Ticket;

    mockTicketRepo.getTicket.mockResolvedValue(ticket);
    mockEventRepo.getEventById.mockResolvedValue(event);

    await expect(service.leaveEvent(token, "t1")).rejects.toThrow("El ticket no es tuyo");
  });

  it("should throw if ticket does not exist", async () => {
    mockTicketRepo.getTicket.mockResolvedValue(null as any);

    await expect(service.leaveEvent(token, "fake")).rejects.toThrow("No existe el ticket");
  });

  // COMPLETE EVENT
  it("should complete event with admin permission", async () => {
    const event = { ...dummyEvent } as Event;
    const completedEvent = { ...dummyEvent, completed: true } as Event;

    mockEventRepo.getEventById.mockResolvedValue(event);
    mockAuthService.assertAdmin.mockResolvedValue(undefined as any);
    mockEventRepo.completeEvent.mockResolvedValue(completedEvent);

    const result = await service.completeEvent(token, event.idEvent);

    expect(mockAuthService.assertAdmin).toHaveBeenCalledWith(token, event.idEvent);
    expect(mockEventRepo.completeEvent).toHaveBeenCalledWith(event.idEvent);
    expect(result).toEqual(completedEvent);
  });

  it("should throw if non-admin tries to complete event", async () => {
    const event = { ...dummyEvent } as Event;

    mockEventRepo.getEventById.mockResolvedValue(event);
    mockAuthService.assertAdmin.mockRejectedValue(new Error("Not admin"));

    await expect(service.completeEvent(token, event.idEvent)).rejects.toThrow("Not admin");
  });
});
