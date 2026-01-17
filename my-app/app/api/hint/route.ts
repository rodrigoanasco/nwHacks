import { NextResponse } from "next/server";

type questionId = {
    message: string
}

export async function POST(req: Request) {
    const body = (await req.json()) as questionId;

    if(!body.message || body.message.trim().length == 0){
        return NextResponse.json(
            {error: "questionId required"},
            {status: 400}
        );
    }

    if(body.message == "123"){
        const hint = "Hahaha, this is the hint"
        return NextResponse.json({ hint });
    }
}