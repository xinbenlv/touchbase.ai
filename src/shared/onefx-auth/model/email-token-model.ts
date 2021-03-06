import mongoose from "mongoose";
import uuidV4 from "uuid/v4";
import koa from "koa";
import { baseModel } from "./base-model";

const { Schema } = mongoose;

type Opts = {
  mongoose: mongoose.Mongoose;
  expMins: number;
};

function getExpireEpochMins(mins: number): number {
  return Date.now() + mins * 60 * 1000;
}

export type EmailToken = {
  token: string;
  userId: string;
  expireAt: string;
};

type EmailTokenModelType = mongoose.Document &
  EmailToken & {
    createAt: Date;
    updateAt: Date;
  };

export class EmailTokenModel {
  public Model: mongoose.Model<EmailTokenModelType>;

  constructor({ mongoose: instance, expMins }: Opts) {
    const EmailTokenSchema = new Schema({
      token: { type: String, default: uuidV4 },
      userId: { type: Schema.Types.ObjectId },
      expireAt: {
        type: Date,
        default: () => new Date(getExpireEpochMins(expMins)),
        index: { expires: `${expMins}m` }
      },

      createAt: { type: Date, default: Date.now },
      updateAt: { type: Date, default: Date.now }
    });

    EmailTokenSchema.index({ token: 1 });

    EmailTokenSchema.plugin(baseModel);
    EmailTokenSchema.pre("save", function onSave(next: koa.Next): void {
      // @ts-ignore
      this.updateAt = new Date();
      next();
    });
    EmailTokenSchema.pre("find", function onFind(next: koa.Next): void {
      // @ts-ignore
      this.updateAt = new Date();
      next();
    });

    this.Model = instance.model("email_tokens", EmailTokenSchema);
  }

  public async newAndSave(userId: string): Promise<EmailToken> {
    return new this.Model({ userId }).save();
  }

  public async findOneAndDelete(token: string): Promise<EmailToken | null> {
    return this.Model.findOneAndDelete({ token });
  }

  public async findOne(token: string): Promise<EmailToken | null> {
    return this.Model.findOne({ token });
  }
}
