import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const swaggerConfig = async (app: INestApplication) => {
  if (process.env.NODE_ENV !== 'production') {
    const options = new DocumentBuilder()
      .setTitle('Maricorp API Specification')
      .setDescription('Documentation for Maricorp API')
      .setVersion('0.1')
      .addBearerAuth();
    const document = SwaggerModule.createDocument(app, options.build());
    SwaggerModule.setup('doc', app, document);
  }
};
