import { describe, expect, it } from 'vitest';
import { buildSwaggerConfig } from './swagger.config';

describe('buildSwaggerConfig', () => {
  it('identifies the gateway in the document metadata', () => {
    const config = buildSwaggerConfig();

    expect(config.info).toMatchObject({
      title: 'Marketplace API Gateway',
      version: '1.0',
      contact: {
        name: 'Marketplace Team',
        url: 'https://marketplace.com',
        email: 'dev@marketplace.com',
      },
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    });
  });

  it('publishes contact and license urls that resolve', () => {
    const { contact, license } = buildSwaggerConfig().info;

    // These were pasted wrapped in angle brackets, which Swagger renders as a
    // dead link.
    expect(contact?.url).toMatch(/^https:\/\//);
    expect(license?.url).toMatch(/^https:\/\//);
  });

  it('writes the description flush left so Swagger renders it as prose', () => {
    const { description } = buildSwaggerConfig().info;

    // An indented line renders as a markdown code block instead of text.
    expect(description).not.toMatch(/^[ \t]+\S/m);
    expect(description).toContain('Available Services:');
  });

  it('declares both schemes the routes authenticate with', () => {
    const schemes = buildSwaggerConfig().components?.securitySchemes;

    expect(schemes?.['JWT-auth']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      in: 'header',
    });
    expect(schemes?.['session-auth']).toMatchObject({
      type: 'apiKey',
      name: 'x-session-token',
      in: 'header',
    });
  });

  it('tags every service the gateway fronts', () => {
    const tags = buildSwaggerConfig().tags?.map((tag) => tag.name);

    expect(tags).toEqual([
      'Authentication',
      'Users',
      'Products',
      'Checkout',
      'Payments',
      'Health',
    ]);
  });

  it('describes every tag, so the sidebar is not a bare list', () => {
    const tags = buildSwaggerConfig().tags ?? [];

    expect(tags).not.toHaveLength(0);
    for (const tag of tags) {
      expect(tag.description).toBeTruthy();
    }
  });
});
