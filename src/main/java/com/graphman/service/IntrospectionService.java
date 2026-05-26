package com.graphman.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graphman.model.GraphQLRequest;
import com.graphman.model.GraphQLSchema;
import com.graphman.model.GraphQLSchema.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;

@Service
public class IntrospectionService {

    private static final Logger log = LoggerFactory.getLogger(IntrospectionService.class);

    private static final String INTROSPECTION_QUERY = """
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            subscriptionType { name }
            types {
              kind
              name
              description
              fields(includeDeprecated: true) {
                name
                description
                args {
                  name
                  description
                  type {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                        ofType {
                          kind
                          name
                        }
                      }
                    }
                  }
                  defaultValue
                }
                type {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                      }
                    }
                  }
                }
              }
              inputFields {
                name
                description
                type {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
              enumValues(includeDeprecated: true) {
                name
                description
              }
            }
          }
        }
        """;

    private final GraphQLService graphQLService;
    private final ObjectMapper objectMapper;

    public IntrospectionService(GraphQLService graphQLService, ObjectMapper objectMapper) {
        this.graphQLService = graphQLService;
        this.objectMapper = objectMapper;
    }

    public Mono<GraphQLSchema> introspect(GraphQLRequest baseRequest) {
        GraphQLRequest introspectionRequest = new GraphQLRequest();
        introspectionRequest.setUrl(baseRequest.getUrl());
        introspectionRequest.setHeaders(baseRequest.getHeaders());
        introspectionRequest.setAuth(baseRequest.getAuth());
        introspectionRequest.setQuery(INTROSPECTION_QUERY);

        return graphQLService.executeQuery(introspectionRequest)
                .map(this::parseSchema)
                .onErrorResume(e -> {
                    log.error("Introspection failed: {}", e.getMessage());
                    return Mono.just(new GraphQLSchema());
                });
    }

    public Mono<JsonNode> introspectRaw(GraphQLRequest baseRequest) {
        GraphQLRequest introspectionRequest = new GraphQLRequest();
        introspectionRequest.setUrl(baseRequest.getUrl());
        introspectionRequest.setHeaders(baseRequest.getHeaders());
        introspectionRequest.setAuth(baseRequest.getAuth());
        introspectionRequest.setQuery(INTROSPECTION_QUERY);

        return graphQLService.executeQuery(introspectionRequest);
    }

    private GraphQLSchema parseSchema(JsonNode response) {
        GraphQLSchema schema = new GraphQLSchema();

        try {
            JsonNode schemaNode = response.path("data").path("__schema");

            if (schemaNode.isMissingNode()) {
                log.warn("No schema data in introspection response");
                return schema;
            }

            // Set root type names
            if (schemaNode.has("queryType") && !schemaNode.get("queryType").isNull()) {
                schema.setQueryTypeName(schemaNode.get("queryType").path("name").asText());
            }
            if (schemaNode.has("mutationType") && !schemaNode.get("mutationType").isNull()) {
                schema.setMutationTypeName(schemaNode.get("mutationType").path("name").asText());
            }
            if (schemaNode.has("subscriptionType") && !schemaNode.get("subscriptionType").isNull()) {
                schema.setSubscriptionTypeName(schemaNode.get("subscriptionType").path("name").asText());
            }

            // Parse types
            JsonNode typesNode = schemaNode.path("types");
            List<GraphQLType> types = new ArrayList<>();

            for (JsonNode typeNode : typesNode) {
                String name = typeNode.path("name").asText();
                // Skip introspection types
                if (name.startsWith("__")) {
                    continue;
                }

                GraphQLType type = parseType(typeNode);
                types.add(type);
            }

            schema.setTypes(types);

        } catch (Exception e) {
            log.error("Failed to parse schema: {}", e.getMessage(), e);
        }

        return schema;
    }

    private GraphQLType parseType(JsonNode typeNode) {
        GraphQLType type = new GraphQLType();
        type.setName(typeNode.path("name").asText());
        type.setKind(typeNode.path("kind").asText());
        type.setDescription(typeNode.path("description").asText(null));

        // Parse fields
        JsonNode fieldsNode = typeNode.path("fields");
        if (!fieldsNode.isMissingNode() && !fieldsNode.isNull()) {
            List<GraphQLField> fields = new ArrayList<>();
            for (JsonNode fieldNode : fieldsNode) {
                fields.add(parseField(fieldNode));
            }
            type.setFields(fields);
        }

        // Parse enum values
        JsonNode enumValuesNode = typeNode.path("enumValues");
        if (!enumValuesNode.isMissingNode() && !enumValuesNode.isNull()) {
            List<GraphQLEnumValue> enumValues = new ArrayList<>();
            for (JsonNode enumNode : enumValuesNode) {
                GraphQLEnumValue enumValue = new GraphQLEnumValue();
                enumValue.setName(enumNode.path("name").asText());
                enumValue.setDescription(enumNode.path("description").asText(null));
                enumValues.add(enumValue);
            }
            type.setEnumValues(enumValues);
        }

        // Parse input fields
        JsonNode inputFieldsNode = typeNode.path("inputFields");
        if (!inputFieldsNode.isMissingNode() && !inputFieldsNode.isNull()) {
            List<GraphQLInputField> inputFields = new ArrayList<>();
            for (JsonNode inputFieldNode : inputFieldsNode) {
                GraphQLInputField inputField = new GraphQLInputField();
                inputField.setName(inputFieldNode.path("name").asText());
                inputField.setDescription(inputFieldNode.path("description").asText(null));
                inputField.setTypeName(extractTypeName(inputFieldNode.path("type")));
                inputField.setNonNull(isNonNull(inputFieldNode.path("type")));
                inputFields.add(inputField);
            }
            type.setInputFields(inputFields);
        }

        return type;
    }

    private GraphQLField parseField(JsonNode fieldNode) {
        GraphQLField field = new GraphQLField();
        field.setName(fieldNode.path("name").asText());
        field.setDescription(fieldNode.path("description").asText(null));

        JsonNode typeInfo = fieldNode.path("type");
        field.setTypeName(extractTypeName(typeInfo));
        field.setNonNull(isNonNull(typeInfo));
        field.setList(isList(typeInfo));

        // Parse arguments
        JsonNode argsNode = fieldNode.path("args");
        if (!argsNode.isMissingNode() && !argsNode.isNull()) {
            List<GraphQLArgument> args = new ArrayList<>();
            for (JsonNode argNode : argsNode) {
                GraphQLArgument arg = new GraphQLArgument();
                arg.setName(argNode.path("name").asText());
                arg.setDescription(argNode.path("description").asText(null));
                arg.setTypeName(extractTypeName(argNode.path("type")));
                arg.setNonNull(isNonNull(argNode.path("type")));
                arg.setDefaultValue(argNode.path("defaultValue").asText(null));
                args.add(arg);
            }
            field.setArgs(args);
        }

        return field;
    }

    private String extractTypeName(JsonNode typeNode) {
        if (typeNode.isMissingNode() || typeNode.isNull()) {
            return "Unknown";
        }

        String kind = typeNode.path("kind").asText();
        String name = typeNode.path("name").asText(null);

        if (name != null && !name.isEmpty()) {
            return name;
        }

        // Recurse into ofType
        return extractTypeName(typeNode.path("ofType"));
    }

    private boolean isNonNull(JsonNode typeNode) {
        if (typeNode.isMissingNode() || typeNode.isNull()) {
            return false;
        }
        return "NON_NULL".equals(typeNode.path("kind").asText());
    }

    private boolean isList(JsonNode typeNode) {
        if (typeNode.isMissingNode() || typeNode.isNull()) {
            return false;
        }

        String kind = typeNode.path("kind").asText();
        if ("LIST".equals(kind)) {
            return true;
        }

        // Check ofType recursively
        JsonNode ofType = typeNode.path("ofType");
        if (!ofType.isMissingNode() && !ofType.isNull()) {
            return isList(ofType);
        }

        return false;
    }
}
