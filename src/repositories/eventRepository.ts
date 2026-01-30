import { Event } from "@prisma/client";

import { db } from "../db/db";
import { EventCategory } from "../services/categoryService";

export class EventRepository {

    static async createEvent(title: string, description: string, shortDescription: string, direction: string, date: Date, price: number | null, free: boolean, creatorID: string, imageURL: string | null, category: EventCategory): Promise<Event> {
        const event = await db.event.create({
            data: {
                title,
                date,
                description,
                shortDescription,
                direction,
                creatorID: creatorID,
                free: free,
                category: category,
                price: price,
                imageURL
            }
        });
        return event;
    }

    static async getEvents(): Promise<Event[]> {
        return db.event.findMany({
            where: { cancelled: false, completed: false },
            include: {
                user: true
            }
        });
    }

    static async getEventById(idEvent: string): Promise<Event | null> {
        return db.event.findUnique({
            where: { idEvent }
        });
    }

    static async getMyEvents(idUser: string): Promise<Event[]>{
        return db.event.findMany({
            where: {
                creatorID: idUser
            },
            include: {
                user: true
            }
        })
    }

    static async deleteEvent(idEvent: string): Promise<Event> {
        const event = await db.event.delete({
            where: { idEvent }
        });
        return event;
    }

    static async completeEvent(idEvent: string): Promise<Event> {
        const event = await db.event.update({
            where: {idEvent},
            data: {completed: true}
        })
        return event
    }

    static async addAssistant(amount: number, eventId: string): Promise<Event> {
        const event = await db.event.update({
            where: {idEvent: eventId},
            data: {
                assistants: {
                    increment: amount
                }
            }
        })
        return event
    }
}