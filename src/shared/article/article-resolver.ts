import { Args, Ctx, Query, Resolver } from "type-graphql";
import { Context } from "../../api-gateway/api-gateway";
import { ArticleService } from "./article-service";
import { ArticleResponse, ArticlesRequest } from "./article-types";

@Resolver(_ => String)
export class ArticleResolver {
  public articleService: ArticleService;

  constructor() {
    this.articleService = new ArticleService(`${__dirname}/articles/`);
  }

  @Query(_ => [ArticleResponse], {
    description: "get the article",
    nullable: true
  })
  public async articles(
    @Args()
    args: ArticlesRequest,
    @Ctx()
    _: Context
  ): Promise<Array<ArticleResponse>> {
    const article = this.articleService.getPostById(args.id);

    return [article];
  }
}
