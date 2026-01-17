import { NextResponse } from "next/server";

type question = {
    id: number
    answer: string
}

export async function POST(req: Request) {
    const body = (await req.json()) as question;

    if(!body.answer || body.answer.trim().length == 0){
        return NextResponse.json(
            {error: "Answer is required"},
            {status: 400}
        );
    }
    if(!body.id){
        return NextResponse.json(
            {error: "Id not sent"},
            {status: 400}
        );
    }

    if(body.id == 123){
        const accepted = "Great job you submitted!"
        return NextResponse.json({ accepted });
    }
}